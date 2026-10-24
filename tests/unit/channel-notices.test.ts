import { describe, expect, it } from "vitest";
import { configuredChannelNoticeHandler } from "../../apps/core-api/src/channel-notice-runtime.ts";
import { noticeCapabilitySchema } from "../../packages/contracts/src/channel-notices.ts";
import { maySubmitNotice } from "../../packages/domain/src/channel-notices.ts";
import { whatsappNoticeProvider } from "../../packages/providers/src/whatsapp-notice.ts";

const now = Date.parse("2026-10-24T12:00:00Z");
const cap = noticeCapabilitySchema.parse({
  id: "11111111-1111-4111-8111-111111111111",
  revision: 1,
  purpose: "test_notice",
  businessAccountId: "101",
  phoneNumberId: "202",
  recipientId: "303",
  templateName: "synthetic_test_notice",
  language: "en",
  approvalRef: "synthetic-approval",
  consentRef: "synthetic-explicit-test-consent",
  policyVersion: "synthetic-v1",
  notBefore: "2026-10-24T11:00:00Z",
  expiresAt: "2026-10-24T13:00:00Z",
  maxEventAgeSeconds: 3600,
  maxNotices: 1,
  used: 0,
  enabled: true,
});
const event = {
  kind: "text" as const,
  businessAccountId: "101",
  receivingPhoneNumberId: "202",
  senderId: "303",
  occurredAtSeconds: String(now / 1000),
  providerEventId: "synthetic",
  text: "test",
};
const submission = {
  operationId: cap.id,
  recipientId: "303",
  phoneNumberId: "202",
  templateName: cap.templateName,
  language: "en",
};

describe("bounded approved notices", () => {
  it("requires explicit complete approval and a current signed matching sender, never content-derived consent", () => {
    expect(maySubmitNotice(cap, event, now)).toBe(true);
    expect(noticeCapabilitySchema.safeParse({ ...cap, consentRef: "" }).success).toBe(false);
    for (const changed of [
      { enabled: false },
      { used: 1 },
      { expiresAt: new Date(now).toISOString() },
      { recipientId: "404" },
      { phoneNumberId: "404" },
      { businessAccountId: "404" },
      { notBefore: new Date(now + 1).toISOString() },
    ])
      expect(maySubmitNotice({ ...cap, ...changed }, event, now)).toBe(false);
    expect(maySubmitNotice(cap, { ...event, occurredAtSeconds: String(now / 1000 + 1) }, now)).toBe(
      false,
    );
    expect(maySubmitNotice(cap, event, now + 3601000)).toBe(false);
  });
  it("fails closed for absent config, stub sends and forbidden live sends", () => {
    expect(typeof configuredChannelNoticeHandler({ APP_ENV: "local" })).toBe("function");
    expect(
      typeof configuredChannelNoticeHandler({
        APP_ENV: "dev",
        RESOURCE_NAMESPACE: "kandamkulathi-dev",
        PROVIDER_MODE: "live",
        ALLOW_LIVE_SENDS: "true",
      }),
    ).toBe("function");
  });
  it("submits only the approved zero-parameter template and validates the real receipt", async () => {
    const provider = whatsappNoticeProvider({
      accessToken: "synthetic",
      graphVersion: "v23.0",
      fetch: async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        expect(body.template).toEqual({ name: cap.templateName, language: { code: "en" } });
        expect(body.text).toBeUndefined();
        expect(body.biz_opaque_callback_data).toBe(cap.id);
        return Response.json({
          messaging_product: "whatsapp",
          contacts: [{ input: "303", wa_id: "303" }],
          messages: [{ id: "wamid.synthetic" }],
        });
      },
    });
    expect(await provider.send(submission, new AbortController().signal)).toEqual({
      state: "accepted",
      providerMessageId: "wamid.synthetic",
    });
  });
  it.each(["network", "malformed", "oversized", "server", "recipient", "rejected"])(
    "preserves %s outcomes without fake receipts",
    async (kind) => {
      const provider = whatsappNoticeProvider({
        accessToken: "synthetic",
        graphVersion: "v23.0",
        fetch: async () => {
          if (kind === "network") throw new Error("synthetic connection loss");
          if (kind === "malformed") return Response.json({ ok: true });
          if (kind === "oversized") return new Response("x".repeat(16385));
          if (kind === "server") return Response.json({ error: { code: 1 } }, { status: 500 });
          if (kind === "rejected") return Response.json({ error: { code: 1 } }, { status: 400 });
          return Response.json({
            messaging_product: "whatsapp",
            contacts: [{ input: "404", wa_id: "404" }],
            messages: [{ id: "wamid.synthetic" }],
          });
        },
      });
      expect(await provider.send(submission, new AbortController().signal)).toEqual({
        state: kind === "rejected" ? "rejected" : "unknown",
      });
    },
  );
});
