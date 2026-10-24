import { expect, test } from "@playwright/test";

// Parent owns root registration and runs this against the actual local workerd;
// no interception, fake ClientSession or code-exchange success fixture is installed.
test("actual Core native auth routes fail closed without company-approved provider/redirect configuration", async ({
  request,
}) => {
  for (const operation of ["start", "exchange", "logout"]) {
    const response = await request.post(`http://127.0.0.1:8787/v1/native-auth/${operation}`, {
      data:
        operation === "start"
          ? {
              state: "s".repeat(43),
              redirectUri: "kandamkulathi-local://auth/return",
              codeChallenge: "c".repeat(43),
              codeChallengeMethod: "S256",
            }
          : operation === "exchange"
            ? {
                state: "s".repeat(43),
                redirectUri: "kandamkulathi-local://auth/return",
                code: "synthetic",
                codeVerifier: "v".repeat(43),
              }
            : {},
      headers:
        operation === "logout"
          ? { Authorization: `Bearer n1_${"x".repeat(43)}`, "Idempotency-Key": "k".repeat(32) }
          : {},
      maxRedirects: 0,
    });
    expect(response.status()).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "IDENTITY_UNAVAILABLE" } });
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.headers()["set-cookie"]).toBeUndefined();
    expect(response.headers().location).toBeUndefined();
  }
});
