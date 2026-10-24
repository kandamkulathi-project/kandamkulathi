import { expect, test } from "@playwright/test";

test("actual Core Worker exposes configured web auth routes without fabricating an unconfigured session", async ({
  request,
}) => {
  for (const path of [
    "/v1/auth/start",
    "/v1/auth/authorize",
    "/v1/auth/callback?code=synthetic&state=synthetic",
    "/v1/security/context",
  ]) {
    const response = await request.get(`http://127.0.0.1:8787${path}`, { maxRedirects: 0 });
    expect(response.status()).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "IDENTITY_UNAVAILABLE" } });
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.headers().location).toBeUndefined();
  }
});
