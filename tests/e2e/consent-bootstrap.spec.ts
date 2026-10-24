import { expect, test } from "@playwright/test";

test("unconfigured actual Worker cannot expose invented privacy policy or bootstrap identity", async ({
  request,
}) => {
  const response = await request.get("http://127.0.0.1:8787/v1/consent-bootstrap", {
    headers: {
      Authorization: "Bearer n1_fabricated",
      "X-Actor-ID": "10000000-0000-4000-8000-000000000001",
      "X-MFA": "true",
    },
  });
  expect(response.status()).toBe(503);
  expect(await response.json()).toMatchObject({ error: { code: "IDENTITY_UNAVAILABLE" } });
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(response.headers()["set-cookie"]).toBeUndefined();
});
