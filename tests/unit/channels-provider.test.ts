import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  channelLimits,
  whatsappNumericIdSchema,
  whatsappProviderIdSchema,
} from "../../packages/contracts/src/channels";
import {
  parseWhatsAppEvents,
  semanticReceipts,
  verifyWhatsAppSignature,
} from "../../packages/providers/src/whatsapp";

const config = {
  appSecret: "synthetic-app-secret-not-a-credential",
  verifyToken: "synthetic-verification-token",
  businessAccountId: "10001",
  receivingPhoneNumberId: "20001",
};
function payload() {
  return {
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
                  text: { body: "Synthetic message; no account authorization." },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const lineTerminators = ["\n", "\r", "\r\n", "\u2028", "\u2029"];
function required<T>(value: T | null | undefined): T {
  assert(value !== null && value !== undefined);
  return value;
}

describe("WhatsApp raw-byte verification and bounded parsing", () => {
  it("verifies real HMAC-SHA256 including whitespace and non-ASCII raw bytes", async () => {
    const raw = new TextEncoder().encode(' {"synthetic":"മലയാളം தமிழ்"}\n');
    const signature = `sha256=${createHmac("sha256", config.appSecret).update(raw).digest("hex")}`;
    expect(await verifyWhatsAppSignature(raw, signature, config.appSecret)).toBe(true);
    expect(await verifyWhatsAppSignature(raw.slice(1), signature, config.appSecret)).toBe(false);
    const altered = raw.slice();
    altered[4] = 88;
    expect(await verifyWhatsAppSignature(altered, signature, config.appSecret)).toBe(false);
    expect(await verifyWhatsAppSignature(raw, signature, "different-synthetic-secret")).toBe(false);
  });
  it.each([
    null,
    "",
    "sha1=abcd",
    "sha256=00",
    `sha256=${"g".repeat(64)}`,
    `sha256=${"0".repeat(64)},sha256=${"0".repeat(64)}`,
    `sha256=${"0".repeat(64)}\n`,
  ])("denies malformed signature %s", async (signature) => {
    expect(await verifyWhatsAppSignature(encode(payload()), signature, config.appSecret)).toBe(
      false,
    );
  });
  it.each(lineTerminators)(
    "rejects an otherwise VALID raw MAC with final line terminator %j",
    async (ending) => {
      // Test the raw verifier, not HTTP header parsing (HTTP stacks may reject/strip line endings).
      const raw = encode(payload());
      const valid = `sha256=${createHmac("sha256", config.appSecret).update(raw).digest("hex")}`;
      expect(await verifyWhatsAppSignature(raw, valid, config.appSecret)).toBe(true);
      expect(await verifyWhatsAppSignature(raw, `${valid}${ending}`, config.appSecret)).toBe(false);
    },
  );
  it("requires exactly 64 signature hex digits, without leading or embedded whitespace", async () => {
    const raw = encode(payload());
    const valid = `sha256=${createHmac("sha256", config.appSecret).update(raw).digest("hex")}`;
    for (const invalid of [
      valid.slice(0, -1),
      `${valid}a`,
      ` ${valid}`,
      valid.replace("=", "=\n"),
    ]) {
      expect(await verifyWhatsAppSignature(raw, invalid, config.appSecret)).toBe(false);
    }
  });
  it("parses bounded text without claiming sender authentication", () => {
    expect(parseWhatsAppEvents(encode(payload()), config)).toEqual([
      {
        businessAccountId: "10001",
        receivingPhoneNumberId: "20001",
        senderId: "30001",
        providerEventId: "wamid.synthetic=",
        occurredAtSeconds: "1000",
        kind: "text",
        text: "Synthetic message; no account authorization.",
      },
    ]);
  });
  it("preserves legitimate multiline text while producing a strict text-content digest", async () => {
    const source = payload();
    const message = required(required(required(source.entry[0]).changes[0]).value.messages[0]);
    message.text.body = "Synthetic first line\nsecond line\u2028third line";
    const events = parseWhatsAppEvents(encode(source), config);
    expect(events[0]).toMatchObject({ text: message.text.body });
    const receipt = required((await semanticReceipts(events))[0]);
    expect(receipt.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    for (const ending of lineTerminators) {
      expect(`${receipt.contentSha256}${ending}`).not.toMatch(/^[a-f0-9]{64}$/);
    }
  });
  it.each(["business-account", "receiving-phone"])("rejects wrong %s identity", (which) => {
    const otherConfig = {
      ...config,
      ...(which === "business-account"
        ? { businessAccountId: "99999" }
        : { receivingPhoneNumberId: "99999" }),
    };
    expect(() => parseWhatsAppEvents(encode(payload()), otherConfig)).toThrow(
      "WhatsApp payload rejected",
    );
  });
  it("rejects a wrong account anywhere in a signed mixed batch", () => {
    const mixed = payload();
    mixed.entry.push({ ...required(mixed.entry[0]), id: "99999" });
    expect(() => parseWhatsAppEvents(encode(mixed), config)).toThrow();
  });
  it.each([
    new Uint8Array([0xff]),
    new TextEncoder().encode("{bad"),
    new Uint8Array(channelLimits.bodyBytes + 1),
    encode({}),
    encode({ ...payload(), unexpected: true }),
  ])("rejects malformed, oversized or unexpected input", (raw) => {
    expect(() => parseWhatsAppEvents(raw, config)).toThrow();
  });
  it("rejects oversized message text and aggregate event count", () => {
    const value = required(required(payload().entry[0]).changes[0]).value;
    const tooLong = {
      ...value,
      messages: [{ ...required(value.messages[0]), text: { body: "x".repeat(4097) } }],
    };
    const withValue = (replacement: unknown) => ({
      object: "whatsapp_business_account",
      entry: [{ id: "10001", changes: [{ field: "messages", value: replacement }] }],
    });
    expect(() => parseWhatsAppEvents(encode(withValue(tooLong)), config)).toThrow();
    const batch = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "10001",
          changes: [value, value].map((item) => ({
            field: "messages",
            value: { ...item, messages: Array.from({ length: 51 }, () => item.messages[0]) },
          })),
        },
      ],
    };
    expect(encode(batch).length).toBeLessThan(channelLimits.bodyBytes);
    expect(() => parseWhatsAppEvents(encode(batch), config)).toThrow();
  });
  it("records bounded audio metadata without fetching media or transcribing", () => {
    const source = payload();
    const value = required(required(source.entry[0]).changes[0]).value;
    const audio = {
      from: "30001",
      id: "wamid.audio=",
      timestamp: "1000",
      type: "audio",
      audio: {
        id: "40001",
        mime_type: "audio/ogg; codecs=opus",
        sha256: `${"A".repeat(43)}=`,
        voice: true,
      },
    };
    const raw = encode({
      ...source,
      entry: [
        { id: "10001", changes: [{ field: "messages", value: { ...value, messages: [audio] } }] },
      ],
    });
    expect(parseWhatsAppEvents(raw, config)[0]).toMatchObject({ kind: "audio", mediaId: "40001" });
  });
  it("deduplicates semantic messages across envelope changes; rejects conflicting content", async () => {
    const events = parseWhatsAppEvents(encode(payload()), config);
    const value = required(required(payload().entry[0]).changes[0]).value;
    const variant = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "10001",
          changes: [
            {
              field: "messages",
              value: {
                ...value,
                contacts: [{ profile: { name: "Different ignored display name" }, wa_id: "30001" }],
              },
            },
          ],
        },
      ],
    };
    const receipts = await semanticReceipts([
      ...events,
      ...parseWhatsAppEvents(encode(variant), config),
    ]);
    expect(receipts).toHaveLength(1);
    expect(receipts[0]?.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(receipts[0]?.semanticKey).not.toContain("Synthetic message");
    const first = required(events[0]);
    expect(first.kind).toBe("text");
    await expect(
      semanticReceipts([
        first,
        { ...first, kind: "text", senderId: "30001", text: "conflicting replay" },
      ]),
    ).rejects.toThrow();
  });
  it("parses minimal delivery statuses without treating them as customer messages", () => {
    const raw = encode({
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
                statuses: ["sent", "delivered", "read", "failed"].map((status) => ({
                  id: "wamid.status=",
                  status,
                  timestamp: "1000",
                  recipient_id: "30001",
                })),
              },
            },
          ],
        },
      ],
    });
    const events = parseWhatsAppEvents(raw, config);
    expect(events).toHaveLength(4);
    expect(events.every((event) => event.kind === "status")).toBe(true);
    expect(events[0]).not.toHaveProperty("senderId");
  });
  it("separates delivery progression and receiving account scopes in semantic keys", async () => {
    const first = {
      businessAccountId: "10001",
      receivingPhoneNumberId: "20001",
      providerEventId: "wamid.synthetic=",
      occurredAtSeconds: "1000",
      kind: "status" as const,
      recipientId: "30001",
      status: "sent" as const,
    };
    const receipts = await semanticReceipts([
      first,
      { ...first, status: "delivered" },
      { ...first, receivingPhoneNumberId: "20002" },
    ]);
    expect(new Set(receipts.map((receipt) => receipt.semanticKey)).size).toBe(3);
  });
});

describe.each([
  { name: "numeric ID", schema: whatsappNumericIdSchema, valid: "12345" },
  { name: "provider ID", schema: whatsappProviderIdSchema, valid: "wamid.synthetic=" },
])("absolute-end channel schema: $name", ({ schema, valid }) => {
  it("accepts the exact valid value", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });
  it.each(lineTerminators)("rejects final line terminator %j", (ending) => {
    expect(schema.safeParse(`${valid}${ending}`).success).toBe(false);
  });
});
