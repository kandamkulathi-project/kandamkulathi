import { expect, test } from "@playwright/test";

test("unconfigured runtime cannot manufacture persisted consent from bearer or actor headers", async ({
  request,
}) => {
  const response = await request.post("http://127.0.0.1:8787/v1/consents", {
    headers: {
      Authorization: "Bearer fabricated",
      "X-Actor-ID": "10000000-0000-4000-8000-000000000001",
      "X-MFA": "true",
    },
    data: {
      requirement: {
        purpose: "privacy",
        version: "unapproved",
        actorId: "10000000-0000-4000-8000-000000000001",
      },
      decision: "granted",
    },
  });
  expect(response.status()).toBe(503);
  expect(await response.json()).toMatchObject({ error: { code: "IDENTITY_UNAVAILABLE" } });
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(response.headers()["set-cookie"]).toBeUndefined();
});
