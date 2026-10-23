import { expect, test } from "@playwright/test";

test("real combined Companion Worker has both boundaries but no enabled business integration", async ({
  request,
}) => {
  const base = "http://127.0.0.1:8788";
  const knowledge = await request.post(`${base}/v1/knowledge/public-product`, {
    data: {},
    headers: { Authorization: "Bearer fabricated", "X-Role": "physician-approver" },
  });
  expect(knowledge.status()).toBe(503);
  expect(await knowledge.json()).toEqual({ status: "not-ready", reason: "NOT_CONFIGURED" });
  const channel = await request.get(
    `${base}/v1/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=fabricated&hub.challenge=123`,
  );
  expect(channel.status()).toBe(503);
  expect(await channel.json()).toMatchObject({ error: { code: "CHANNEL_UNAVAILABLE" } });
  expect((await request.get(`${base}/health/ready`)).status()).toBe(503);
  expect((await request.get(`${base}/health/live`)).status()).toBe(200);
  for (const response of [knowledge, channel]) {
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  }
});
