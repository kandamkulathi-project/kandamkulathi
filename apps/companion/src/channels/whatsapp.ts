import {
  type ChannelErrorCode,
  channelLimits,
  type DurableChannelInbox,
  whatsappConfigSchema,
} from "@kandamkulathi/contracts/channels";
import {
  parseWhatsAppEvents,
  semanticReceipts,
  verifyWhatsAppSignature,
  WhatsAppPayloadError,
} from "@kandamkulathi/providers/whatsapp";

export type WhatsAppDependencies = Readonly<{ config?: unknown; inbox?: DurableChannelInbox }>;

/** Read bindings without widening the shared HTTP runtime or accepting config from a request. */
export function whatsappConfigFromBindings(bindings: unknown): unknown {
  if (!bindings || typeof bindings !== "object") return undefined;
  const values = bindings as Record<string, unknown>;
  return {
    appSecret: values.WHATSAPP_APP_SECRET,
    verifyToken: values.WHATSAPP_VERIFY_TOKEN,
    businessAccountId: values.WHATSAPP_BUSINESS_ACCOUNT_ID,
    receivingPhoneNumberId: values.WHATSAPP_PHONE_NUMBER_ID,
  };
}

function channelFailure(code: ChannelErrorCode, status: number, requestId: string): Response {
  return Response.json(
    { error: { code, message: "Channel request could not be accepted.", requestId } },
    { status, headers: { "Cache-Control": "no-store", "X-Request-ID": requestId } },
  );
}

/** Bounded stream read, including chunked requests without a truthful Content-Length. */
async function readRawBody(request: Request): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > channelLimits.bodyBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const raw = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    raw.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return raw;
}

export async function handleWhatsAppWebhook(
  request: Request,
  dependencies: WhatsAppDependencies,
  requestId: string = crypto.randomUUID(),
): Promise<Response> {
  const failure = (code: ChannelErrorCode, status: number) =>
    channelFailure(code, status, requestId);
  const parsedConfig = whatsappConfigSchema.safeParse(dependencies.config);
  if (!parsedConfig.success) return failure("CHANNEL_UNAVAILABLE", 503);
  const config = parsedConfig.data;
  if (request.method === "GET") {
    const query = new URL(request.url).searchParams;
    const allowed = ["hub.mode", "hub.verify_token", "hub.challenge"];
    if (
      [...query.keys()].some((key) => !allowed.includes(key)) ||
      allowed.some((key) => query.getAll(key).length !== 1) ||
      query.get("hub.mode") !== "subscribe" ||
      query.get("hub.verify_token") !== config.verifyToken
    )
      return failure("CHALLENGE_DENIED", 403);
    const challenge = query.get("hub.challenge") ?? "";
    if (!/^\d{1,128}$/.test(challenge)) return failure("INVALID_CHALLENGE", 400);
    return new Response(challenge, {
      headers: { "Content-Type": "text/plain; charset=UTF-8", "Cache-Control": "no-store" },
    });
  }
  if (request.method !== "POST") return failure("METHOD_NOT_ALLOWED", 405);
  if (!dependencies.inbox) return failure("CHANNEL_UNAVAILABLE", 503);
  if (
    request.headers.get("content-encoding") &&
    request.headers.get("content-encoding") !== "identity"
  )
    return failure("INVALID_BODY", 415);
  if (
    request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json"
  )
    return failure("INVALID_BODY", 415);
  try {
    const raw = await readRawBody(request);
    if (!raw) return failure("PAYLOAD_TOO_LARGE", 413);
    if (
      !(await verifyWhatsAppSignature(
        raw,
        request.headers.get("x-hub-signature-256"),
        config.appSecret,
      ))
    )
      return failure("SIGNATURE_DENIED", 401);
    const receipts = await semanticReceipts(parseWhatsAppEvents(raw, config));
    const result = await dependencies.inbox.commitBatch(receipts);
    if (
      result?.outcome !== "committed" ||
      !Number.isSafeInteger(result.inserted) ||
      !Number.isSafeInteger(result.duplicates) ||
      result.inserted < 0 ||
      result.duplicates < 0 ||
      result.inserted + result.duplicates !== receipts.length
    )
      return failure("RECEIPT_UNAVAILABLE", 503);
    return Response.json({ received: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof WhatsAppPayloadError)
      return failure(
        error.reason === "identity" ? "CHANNEL_IDENTITY_DENIED" : "INVALID_BODY",
        error.reason === "identity" ? 403 : 400,
      );
    // No raw body, provider credential, storage exception or signature is logged/echoed.
    return failure("RECEIPT_UNAVAILABLE", 503);
  }
}
