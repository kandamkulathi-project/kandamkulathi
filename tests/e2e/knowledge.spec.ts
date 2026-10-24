import { expect, test } from "@playwright/test";

// Actual default Worker, not a fixture endpoint. Positive primary/authority cases are HTTP tests.
test("unconfigured knowledge remains fail-closed inside actual workerd", async ({ request }) => {
  const base = "http://127.0.0.1:8788";
  const response = await request.post(`${base}/v1/knowledge/public-product`, {
    headers: { "X-Role": "physician-approver", Authorization: "Bearer fabricated" },
    data: {
      schemaVersion: 1,
      mode: "public-product",
      productId: "10000000-0000-4000-8000-000000000001",
      language: "en",
      candidates: [
        {
          entryId: "10000000-0000-4000-8000-000000000010",
          revision: 1,
          contentHash: "a".repeat(64),
          origin: "vector",
        },
      ],
    },
  });
  expect(response.status()).toBe(503);
  expect(await response.json()).toEqual({ status: "not-ready", reason: "NOT_CONFIGURED" });
  expect(response.headers()["cache-control"]).toBe("no-store");
  const personalized = await request.post(`${base}/v1/knowledge/personalized`, { data: {} });
  expect(personalized.status()).toBe(503);
  expect(await personalized.json()).toEqual({
    status: "blocked",
    reason: "PERSONALIZED_POLICY_UNAVAILABLE",
  });
  const approval = await request.post(`${base}/v1/knowledge/approve`, {
    headers: { "X-Role": "physician" },
    data: {},
  });
  expect(approval.status()).toBe(503);
  expect(await approval.json()).toMatchObject({ error: { code: "FEATURE_UNAVAILABLE" } });
});

test("workerd rejects malformed and oversized knowledge input without content or fixture leakage", async ({
  request,
}) => {
  const path = "http://127.0.0.1:8788/v1/knowledge/public-product";
  const malformed = await request.post(path, {
    headers: { "Content-Type": "application/json" },
    // A Buffer prevents Playwright from JSON-quoting an invalid JSON string.
    data: Buffer.from("{"),
  });
  expect(malformed.status()).toBe(400);
  expect(await malformed.json()).toEqual({ status: "blocked", reason: "INVALID_REQUEST" });
  const oversized = await request.post(path, {
    headers: { "Content-Type": "application/json" },
    data: Buffer.from("x".repeat(65537)),
  });
  expect(oversized.status()).toBe(413);
  expect(await oversized.json()).toMatchObject({ error: { code: "PAYLOAD_TOO_LARGE" } });
  expect(oversized.headers()["cache-control"]).toBe("no-store");
});
