import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createCompanionService } from "../../apps/companion/src/channels";
import { handleWhatsAppWebhook } from "../../apps/companion/src/channels/whatsapp";
import type {
  DurableChannelInbox,
  InboxCommitResult,
  SemanticInboxReceipt,
} from "../../packages/contracts/src/channels";
import { channelErrorSchema } from "../../packages/contracts/src/channels";

const config = {
  appSecret: "synthetic-app-secret-not-a-credential",
  verifyToken: "synthetic-verification-token",
  businessAccountId: "10001",
  receivingPhoneNumberId: "20001",
};
const url = "http://localhost/v1/channels/whatsapp/webhook";
const body = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "10001",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "0000000000", phone_number_id: "20001" },
            messages: [
              {
                from: "30001",
                id: "wamid.synthetic=",
                timestamp: "1000",
                type: "text",
                text: { body: "Synthetic private fixture" },
              },
            ],
          },
        },
      ],
    },
  ],
});
function request(raw = body, signature?: string) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256":
        signature ?? `sha256=${createHmac("sha256", config.appSecret).update(raw).digest("hex")}`,
    },
    body: raw,
  });
}
// These are deliberately contract doubles, NOT a durable adapter or PostgreSQL/provider proof.
function repository(
  result: InboxCommitResult = { outcome: "committed", inserted: 1, duplicates: 0 },
) {
  return { commitBatch: vi.fn<DurableChannelInbox["commitBatch"]>().mockResolvedValue(result) };
}

describe("durable inbox acknowledgement boundary (contract doubles only)", () => {
  it("does not acknowledge until the injected commit actually resolves", async () => {
    let complete!: (result: InboxCommitResult) => void;
    let observed!: () => void;
    const started = new Promise<void>((resolve) => {
      observed = resolve;
    });
    const inbox: DurableChannelInbox = {
      commitBatch: vi.fn((_receipts: readonly SemanticInboxReceipt[]) => {
        observed();
        return new Promise<InboxCommitResult>((resolve) => {
          complete = resolve;
        });
      }),
    };
    let acknowledged = false;
    const pending = handleWhatsAppWebhook(request(), { config, inbox }).then((response) => {
      acknowledged = true;
      return response;
    });
    await started;
    expect(acknowledged).toBe(false);
    complete({ outcome: "committed", inserted: 1, duplicates: 0 });
    expect((await pending).status).toBe(200);
    expect(inbox.commitBatch).toHaveBeenCalledWith([
      expect.objectContaining({
        contentSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        event: expect.objectContaining({ kind: "text" }),
      }),
    ]);
  });
  it("acknowledges an already committed duplicate without executing a domain action", async () => {
    const inbox = repository({ outcome: "committed", inserted: 0, duplicates: 1 });
    const response = await handleWhatsAppWebhook(request(), { config, inbox });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(inbox.commitBatch).toHaveBeenCalledTimes(1);
  });
  it("returns retryable 503 before acknowledgement on storage failure, without leaking details", async () => {
    const inbox = repository();
    inbox.commitBatch.mockRejectedValue(new Error("synthetic-private-database-detail"));
    const response = await handleWhatsAppWebhook(request(), { config, inbox });
    expect(response.status).toBe(503);
    const error = channelErrorSchema.parse(await response.json());
    expect(error.error.requestId).toBe(response.headers.get("x-request-id"));
    expect(JSON.stringify(error)).not.toMatch(/synthetic-private|Synthetic private fixture|secret/);
  });
  it.each([
    { outcome: "committed", inserted: 0, duplicates: 0 },
    { outcome: "committed", inserted: -1, duplicates: 2 },
    { outcome: "committed", inserted: 0.5, duplicates: 0.5 },
  ] as const)("rejects inconsistent repository confirmation %j", async (result) => {
    expect(
      (await handleWhatsAppWebhook(request(), { config, inbox: repository(result) })).status,
    ).toBe(503);
  });
  it("has no production in-memory fallback, even with a valid signature", async () => {
    expect((await handleWhatsAppWebhook(request(), { config })).status).toBe(503);
    expect((await handleWhatsAppWebhook(request(), { inbox: repository() })).status).toBe(503);
    expect((await createCompanionService().fetch(request())).status).toBe(503);
  });
  it.each(["sha256=bad", `sha256=${"0".repeat(64)}`])(
    "rejects signature %s before storage",
    async (signature) => {
      const inbox = repository();
      expect(
        (await handleWhatsAppWebhook(request(body, signature), { config, inbox })).status,
      ).toBe(401);
      expect(inbox.commitBatch).not.toHaveBeenCalled();
    },
  );
  it("rejects raw-byte tampering even when the JSON meaning is unchanged", async () => {
    const signed = request();
    const inbox = repository();
    const response = await handleWhatsAppWebhook(
      request(` ${body}`, signed.headers.get("x-hub-signature-256") ?? ""),
      { config, inbox },
    );
    expect(response.status).toBe(401);
    expect(inbox.commitBatch).not.toHaveBeenCalled();
  });
  it.each([body.replace('"10001"', '"99999"'), body.replace('"20001"', '"99999"')])(
    "rejects a signed wrong account or receiving number before storage",
    async (raw) => {
      const inbox = repository();
      expect((await handleWhatsAppWebhook(request(raw), { config, inbox })).status).toBe(403);
      expect(inbox.commitBatch).not.toHaveBeenCalled();
    },
  );
  it.each(["{", "{}", body.replace('"text"', '"unsupported"')])(
    "rejects signed invalid body before storage",
    async (raw) => {
      const inbox = repository();
      expect((await handleWhatsAppWebhook(request(raw), { config, inbox })).status).toBe(400);
      expect(inbox.commitBatch).not.toHaveBeenCalled();
    },
  );
  it("bounds chunked body reads without trusting Content-Length", async () => {
    const inbox = repository();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(32_768));
        controller.enqueue(new Uint8Array(32_769));
        controller.close();
      },
    });
    const raw = new Request(url, {
      method: "POST",
      body: stream,
      duplex: "half",
      headers: { "content-type": "application/json", "content-length": "1" },
    } as RequestInit);
    expect((await handleWhatsAppWebhook(raw, { config, inbox })).status).toBe(413);
    expect(inbox.commitBatch).not.toHaveBeenCalled();
  });
  it("rejects unsupported encoding and content type", async () => {
    for (const [header, value] of [
      ["content-type", "text/plain"],
      ["content-encoding", "gzip"],
    ] as const) {
      const raw = request();
      raw.headers.set(header, value);
      const inbox = repository();
      expect((await handleWhatsAppWebhook(raw, { config, inbox })).status).toBe(415);
      expect(inbox.commitBatch).not.toHaveBeenCalled();
    }
  });
  it("registers before the shared fallback, preserves shared headers and keeps unrelated features unavailable", async () => {
    const app = createCompanionService({ config, inbox: repository() });
    const response = await app.fetch(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toMatch(/^[a-f0-9-]{36}$/);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect((await app.request("/v1/channels/whatsapp/link", { method: "POST" })).status).toBe(503);
    expect((await app.request("/health/ready")).status).toBe(503);
  });
});

describe("configured challenge handling", () => {
  const query = (suffix = "") =>
    new Request(
      `${url}?hub.mode=subscribe&hub.verify_token=${config.verifyToken}&hub.challenge=123456${suffix}`,
    );
  it("returns only the configured numeric challenge, not a receipt acknowledgement", async () => {
    const response = await handleWhatsAppWebhook(query(), { config });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("123456");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("uses configured Worker bindings but still requires a durable adapter for POST", async () => {
    const env = {
      APP_ENV: "local",
      WHATSAPP_APP_SECRET: config.appSecret,
      WHATSAPP_VERIFY_TOKEN: config.verifyToken,
      WHATSAPP_BUSINESS_ACCOUNT_ID: config.businessAccountId,
      WHATSAPP_PHONE_NUMBER_ID: config.receivingPhoneNumberId,
    };
    const app = createCompanionService();
    expect((await app.request(query().url, undefined, env)).status).toBe(200);
    expect((await app.fetch(request(), env)).status).toBe(503);
  });
  it.each(["&hub.challenge=1", "&hub.verify_token=other", "&extra=true"])(
    "rejects ambiguous/unknown query %s",
    async (suffix) => {
      expect((await handleWhatsAppWebhook(query(suffix), { config })).status).toBe(403);
    },
  );
  it("denies wrong token, missing configuration and nonnumeric reflection", async () => {
    expect(
      (
        await handleWhatsAppWebhook(
          new Request(query().url.replace(config.verifyToken, "fabricated")),
          { config },
        )
      ).status,
    ).toBe(403);
    expect((await handleWhatsAppWebhook(query(), {})).status).toBe(503);
    expect(
      (
        await handleWhatsAppWebhook(new Request(query().url.replace("123456", "%3Cscript%3E")), {
          config,
        })
      ).status,
    ).toBe(400);
  });
  it.each(["\n", "\r", "\r\n", "\u2028", "\u2029"])(
    "rejects URL-encoded challenge final line terminator %j",
    async (ending) => {
      const encoded = new Request(
        query().url.replace("123456", `123456${encodeURIComponent(ending)}`),
      );
      const response = await handleWhatsAppWebhook(encoded, { config });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: "INVALID_CHALLENGE" } });
    },
  );
});
