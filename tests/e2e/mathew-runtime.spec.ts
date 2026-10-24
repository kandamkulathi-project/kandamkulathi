import { expect, test } from "@playwright/test";

test("real Worker consent route rejects invalid input and untrusted origins without manufacturing consent", async ({
  request,
}) => {
  for (const headers of [
    { Cookie: "session=fabricated" },
    { Origin: "https://untrusted.example" },
  ]) {
    const response = await request.post("http://127.0.0.1:8787/v1/consents", { headers, data: {} });
    expect(response.status()).toBe("Origin" in headers ? 403 : 400);
    expect(await response.json()).toMatchObject({
      error: { code: "Origin" in headers ? "ORIGIN_FORBIDDEN" : "INVALID_INPUT" },
    });
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.headers()["set-cookie"]).toBeUndefined();
  }
  // A syntactically valid consent still cannot establish identity from a fabricated cookie.
  const valid = await request.post("http://127.0.0.1:8787/v1/consents", {
    headers: { Cookie: "session=fabricated" },
    data: {
      requirement: {
        purpose: "privacy",
        version: "synthetic-v1",
        actorId: "10000000-0000-4000-8000-000000000001",
      },
      decision: "granted",
    },
  });
  expect(valid.status()).toBe(503);
  expect(await valid.json()).toMatchObject({ error: { code: "IDENTITY_UNAVAILABLE" } });
  expect(valid.headers()["cache-control"]).toBe("no-store");
  expect(valid.headers()["set-cookie"]).toBeUndefined();
});
