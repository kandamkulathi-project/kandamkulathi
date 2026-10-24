import { expect, test } from "@playwright/test";

// Actual default Companion Worker HTTP checks. No provider traffic, configured secrets or receipt
// store. Positive signature/commit cases use contract doubles in integration, not fake durability.
const webhook = "http://127.0.0.1:8788/v1/channels/whatsapp/webhook";
test("local workerd never acknowledges an unconfigured WhatsApp challenge or callback", async ({
  request,
}) => {
  const challenge = await request.get(
    `${webhook}?hub.mode=subscribe&hub.verify_token=fabricated&hub.challenge=123`,
  );
  expect(challenge.status()).toBe(503);
  expect(await challenge.json()).toMatchObject({ error: { code: "CHANNEL_UNAVAILABLE" } });
  for (const signature of ["sha256=bad", `sha256=${"0".repeat(64)}`]) {
    const callback = await request.post(webhook, {
      headers: {
        "X-Hub-Signature-256": signature,
        "Content-Type": "application/json",
        Authorization: "Bearer fabricated",
        "X-Role": "admin",
      },
      data: "{}",
    });
    expect(callback.status()).toBe(503);
    expect(await callback.json()).toMatchObject({ error: { code: "CHANNEL_UNAVAILABLE" } });
    expect(callback.headers()["cache-control"]).toBe("no-store");
    expect(callback.headers()["x-content-type-options"]).toBe("nosniff");
  }
});

test("local workerd bounds oversized channel requests before handling and exposes no unchecked action route", async ({
  request,
}) => {
  const oversized = await request.post(webhook, {
    headers: { "Content-Type": "application/json" },
    data: Buffer.from("x".repeat(65_537)),
  });
  expect(oversized.status()).toBe(413);
  expect(await oversized.json()).toMatchObject({ error: { code: "PAYLOAD_TOO_LARGE" } });
  for (const path of ["link", "transcripts/confirm", "ownership", "send"]) {
    const denied = await request.post(`http://127.0.0.1:8788/v1/channels/whatsapp/${path}`, {
      headers: { Authorization: "Bearer fabricated" },
      data: { role: "admin", confirmed: true, text: "send now" },
    });
    expect(denied.status()).toBe(503);
    expect(await denied.json()).toMatchObject({ error: { code: "FEATURE_UNAVAILABLE" } });
  }
  expect((await request.get("http://127.0.0.1:8788/health/ready")).status()).toBe(503);
});
