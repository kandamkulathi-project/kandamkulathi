import { describe, expect, it } from "vitest";
import {
  approvedBearerOrigin,
  verifyBearerMutation,
} from "../../packages/server/src/bearer-mutation";

const url = "https://api.example/v1/bookings";
const bindings = {
  APP_ENV: "dev",
  BROWSER_ALLOWED_ORIGINS: "https://staff.example,https://api.example",
};
const request = (headers: Record<string, string>) => new Request(url, { method: "POST", headers });
describe("nonambient bearer mutation transport", () => {
  it("permits native and approved-origin bearer transport but does not verify identity itself", () => {
    expect(
      verifyBearerMutation(request({ Authorization: "Bearer signed.token.value" }), bindings),
    ).toBe(true);
    expect(
      verifyBearerMutation(
        request({ Authorization: "Bearer signed.token.value", Origin: "https://staff.example" }),
        bindings,
      ),
    ).toBe(true);
    expect(
      verifyBearerMutation(
        request({ Authorization: "Bearer signed.token.value", Origin: "https://api.example" }),
        bindings,
      ),
    ).toBe(true);
  });
  it("rejects cookies, missing credentials, opaque and unapproved origins", () => {
    for (const headers of [
      {},
      { Authorization: "Basic invalid" },
      { Authorization: "Bearer token", Cookie: "session=ambient" },
      { Authorization: "Bearer token", Origin: "null" },
      { Authorization: "Bearer token", Origin: "https://attacker.example" },
    ])
      expect(verifyBearerMutation(request(headers), bindings)).toBe(false);
  });
  it("requires approved exact HTTPS operator origins and rejects a malformed whole allowlist", () => {
    expect(approvedBearerOrigin("https://staff.example", url, { APP_ENV: "dev" })).toBe(false);
    for (const value of [
      "*",
      "http://staff.example",
      "https://staff.example/path",
      "https://staff.example,https://staff.example",
    ]) {
      expect(
        approvedBearerOrigin("https://staff.example", url, {
          ...bindings,
          BROWSER_ALLOWED_ORIGINS: value,
        }),
      ).toBe(false);
    }
    expect(approvedBearerOrigin("https://staff.example/", url, bindings)).toBe(false);
  });
  it("limits local development exceptions to the existing known frontend ports", () => {
    expect(approvedBearerOrigin("http://127.0.0.1:5173", url, { APP_ENV: "local" })).toBe(true);
    expect(approvedBearerOrigin("http://127.0.0.1:9999", url, { APP_ENV: "local" })).toBe(false);
    expect(approvedBearerOrigin("http://127.0.0.1:5173", url, { APP_ENV: "dev" })).toBe(false);
  });
});
