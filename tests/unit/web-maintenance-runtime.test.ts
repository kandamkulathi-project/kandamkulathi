import { describe, expect, it } from "vitest";
import {
  createConfiguredWebMaintenance,
  trustedCloudflareClientAddress,
} from "../../apps/core-api/src/web-maintenance-runtime";

describe("configured web admission platform boundary", () => {
  it("does not promote forwarding headers into platform address proof", () => {
    const request = new Request("https://api.example.test/v1/session", {
      headers: {
        "CF-Connecting-IP": "192.0.2.1",
        "X-Forwarded-For": "192.0.2.1",
        "X-Real-IP": "192.0.2.1",
      },
    });
    expect(trustedCloudflareClientAddress(request)).toBeNull();
  });

  it("reads the provider-owned address only alongside actual request metadata", () => {
    const request = new Request("https://api.example.test/v1/session", {
      headers: { "CF-Connecting-IP": "192.0.2.1" },
    });
    Object.defineProperty(request, "cf", { value: { colo: "BOM" } });
    expect(trustedCloudflareClientAddress(request)).toBe("192.0.2.1");
  });

  it.each([null, {}, { colo: "client-selected" }, { colo: 123 }])(
    "rejects absent or malformed metadata %#",
    (cf) => {
      const request = new Request("https://api.example.test/v1/session", {
        headers: { "CF-Connecting-IP": "192.0.2.1" },
      });
      Object.defineProperty(request, "cf", { value: cf });
      expect(trustedCloudflareClientAddress(request)).toBeNull();
    },
  );

  it("leaves unconfigured admission unavailable without falling back to uncapped transport", async () => {
    const maintenance = createConfiguredWebMaintenance({ APP_ENV: "local" });
    const admission = maintenance.forRequest(new Request("http://localhost/v1/auth/start"));
    expect(await admission.admit("start")).toBe("unavailable");
    await expect(
      admission.transport("https://api.workos.com/user_management/authenticate"),
    ).rejects.toThrow();
    await expect(maintenance.runCron()).rejects.toThrow();
  });
});
