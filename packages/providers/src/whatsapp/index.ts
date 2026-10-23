import {
  channelLimits,
  whatsappProviderIdSchema as eventId,
  whatsappNumericIdSchema as numericId,
  type SemanticInboxReceipt,
  type WhatsAppConfig,
  type WhatsAppInboxEvent,
} from "@kandamkulathi/contracts/channels";
import { z } from "zod";

const timestamp = z.string().regex(/^\d{1,16}$/);
const messageBase = { from: numericId, id: eventId, timestamp };
const message = z.discriminatedUnion("type", [
  z
    .object({
      ...messageBase,
      type: z.literal("text"),
      text: z.object({ body: z.string().min(1).max(channelLimits.textCharacters) }).strict(),
    })
    .strict(),
  z
    .object({
      ...messageBase,
      type: z.literal("audio"),
      audio: z
        .object({
          id: eventId,
          mime_type: z.enum([
            "audio/aac",
            "audio/mp4",
            "audio/mpeg",
            "audio/amr",
            "audio/ogg; codecs=opus",
            "audio/ogg",
          ]),
          sha256: z.string().regex(/^[A-Za-z0-9+/]{43}=$/),
          voice: z.boolean().optional(),
        })
        .strict(),
    })
    .strict(),
]);
const status = z
  .object({
    id: eventId,
    status: z.enum(["sent", "delivered", "read", "failed"]),
    timestamp,
    recipient_id: numericId,
  })
  .strict();
const envelope = z
  .object({
    object: z.literal("whatsapp_business_account"),
    entry: z
      .array(
        z
          .object({
            id: numericId,
            changes: z
              .array(
                z
                  .object({
                    field: z.literal("messages"),
                    value: z
                      .object({
                        messaging_product: z.literal("whatsapp"),
                        metadata: z
                          .object({
                            display_phone_number: z.string().min(1).max(32),
                            phone_number_id: numericId,
                          })
                          .strict(),
                        contacts: z
                          .array(
                            z
                              .object({
                                profile: z.object({ name: z.string().max(256) }).strict(),
                                wa_id: numericId,
                              })
                              .strict(),
                          )
                          .max(channelLimits.events)
                          .optional(),
                        messages: z.array(message).min(1).max(channelLimits.events).optional(),
                        statuses: z.array(status).min(1).max(channelLimits.events).optional(),
                      })
                      .strict()
                      .refine((value) => Boolean(value.messages) !== Boolean(value.statuses)),
                  })
                  .strict(),
              )
              .min(1)
              .max(channelLimits.events),
          })
          .strict(),
      )
      .min(1)
      .max(channelLimits.events),
  })
  .strict();

export class WhatsAppPayloadError extends Error {
  constructor(readonly reason: "invalid" | "identity") {
    super("WhatsApp payload rejected");
  }
}

/** Verify the exact raw bytes; never JSON parse/reserialize before verification. */
export async function verifyWhatsAppSignature(
  raw: Uint8Array,
  signature: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!signature || !/^sha256=[a-fA-F0-9]{64}$/.test(signature)) return false;
  const bytes = Uint8Array.from(signature.slice(7).match(/../g) ?? [], (pair) =>
    Number.parseInt(pair, 16),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify("HMAC", key, bytes, new Uint8Array(raw));
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function parseWhatsAppEvents(raw: Uint8Array, config: WhatsAppConfig): WhatsAppInboxEvent[] {
  if (raw.byteLength > channelLimits.bodyBytes) throw new WhatsAppPayloadError("invalid");
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(raw));
  } catch {
    throw new WhatsAppPayloadError("invalid");
  }
  const result = envelope.safeParse(parsed);
  if (!result.success) throw new WhatsAppPayloadError("invalid");
  const events: WhatsAppInboxEvent[] = [];
  for (const entry of result.data.entry) {
    if (entry.id !== config.businessAccountId) throw new WhatsAppPayloadError("identity");
    for (const change of entry.changes) {
      if (change.value.metadata.phone_number_id !== config.receivingPhoneNumberId)
        throw new WhatsAppPayloadError("identity");
      const base = {
        businessAccountId: entry.id,
        receivingPhoneNumberId: change.value.metadata.phone_number_id,
      };
      for (const item of change.value.messages ?? []) {
        const common = {
          ...base,
          senderId: item.from,
          providerEventId: item.id,
          occurredAtSeconds: item.timestamp,
        };
        events.push(
          item.type === "text"
            ? { ...common, kind: "text", text: item.text.body }
            : {
                ...common,
                kind: "audio",
                mediaId: item.audio.id,
                mimeType: item.audio.mime_type,
                mediaSha256: item.audio.sha256,
              },
        );
      }
      for (const item of change.value.statuses ?? [])
        events.push({
          ...base,
          kind: "status",
          providerEventId: item.id,
          recipientId: item.recipient_id,
          occurredAtSeconds: item.timestamp,
          status: item.status,
        });
      if (events.length > channelLimits.events) throw new WhatsAppPayloadError("invalid");
    }
  }
  return events;
}

export async function semanticReceipts(
  events: readonly WhatsAppInboxEvent[],
): Promise<SemanticInboxReceipt[]> {
  const unique = new Map<string, SemanticInboxReceipt>();
  for (const event of events) {
    const semanticKey = JSON.stringify([
      "whatsapp",
      event.businessAccountId,
      event.receivingPhoneNumberId,
      event.kind === "status" ? "status" : "message",
      event.providerEventId,
      event.kind === "status" ? event.status : null,
    ]);
    const content = [
      event.kind,
      event.businessAccountId,
      event.receivingPhoneNumberId,
      event.providerEventId,
      event.occurredAtSeconds,
      ...(event.kind === "text"
        ? [event.senderId, event.text]
        : event.kind === "audio"
          ? [event.senderId, event.mediaId, event.mimeType, event.mediaSha256]
          : [event.recipientId, event.status]),
    ];
    const contentSha256 = await sha256Hex(new TextEncoder().encode(JSON.stringify(content)));
    const existing = unique.get(semanticKey);
    if (existing && existing.contentSha256 !== contentSha256)
      throw new WhatsAppPayloadError("invalid");
    unique.set(semanticKey, { semanticKey, contentSha256, event });
  }
  return [...unique.values()];
}
