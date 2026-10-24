import { describe, expect, it, vi } from "vitest";
import {
  createConfiguredCoreApi,
  createConfiguredIdentityRuntime,
} from "../../apps/core-api/src/runtime";
import type { DatabaseClient } from "../../packages/database/src/client";
import { physicianIdentity } from "../unit/identity-fixtures";

describe("configured Core identity composition", () => {
  it("exports one fail-closed native/web factory for other server domains and rejects ambiguous credentials", async () => {
    const runtime = createConfiguredIdentityRuntime({ APP_ENV: "local" });
    expect(
      await runtime.dependencies.verifySession(
        new Request("https://core.example/v1/session", {
          headers: { cookie: "untrusted=1", authorization: "Bearer forged" },
        }),
      ),
    ).toEqual({ status: "unauthenticated" });
    await expect(
      runtime.withSessionInTransaction(
        {} as DatabaseClient,
        new Request("https://core.example/v1/orders"),
        physicianIdentity(),
        async () => "forged",
      ),
    ).rejects.toThrow("Verified session transport required");
    await expect(
      runtime.withSessionInTransaction(
        {} as DatabaseClient,
        new Request("https://core.example/v1/orders", {
          headers: { authorization: "Bearer synthetic" },
        }),
        physicianIdentity(),
        async () => "forged",
      ),
    ).rejects.toThrow("Identity requires platform transaction");
  });
  it("keeps identity unavailable without approved provider configuration", async () => {
    const app = createConfiguredCoreApi({ APP_ENV: "local" });
    const response = await app.request("/v1/session", {}, { APP_ENV: "local" });
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("IDENTITY_UNAVAILABLE");
  });
  it("never forwards an opaque native handle to the legacy WorkOS JWT verifier", async () => {
    const network = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Unexpected network"));
    try {
      const request = new Request("https://core.example/v1/session", {
        headers: { authorization: `Bearer n1_${"a".repeat(43)}` },
      });
      const runtime = createConfiguredIdentityRuntime({ APP_ENV: "local" }, request);
      expect(await runtime.dependencies.verifySession(request)).toEqual({ status: "unavailable" });
      expect(network).not.toHaveBeenCalled();
      await expect(
        runtime.withSessionInTransaction(
          {} as DatabaseClient,
          request,
          physicianIdentity(),
          async () => "forged",
        ),
      ).rejects.toThrow("Native guard requires platform transaction");
    } finally {
      network.mockRestore();
    }
  });
  it("rejects ambiguous transport before opening any same-transaction business guard", async () => {
    const request = new Request("https://core.example/v1/orders", {
      headers: { cookie: "untrusted=1", authorization: `Bearer n1_${"a".repeat(43)}` },
    });
    const runtime = createConfiguredIdentityRuntime({ APP_ENV: "local" }, request);
    await expect(
      runtime.withSessionInTransaction(
        {} as DatabaseClient,
        request,
        physicianIdentity(),
        async () => "forged",
      ),
    ).rejects.toThrow("Ambiguous session transport");
  });
  it("runs the platform guard before any configured identity dependency", async () => {
    const app = createConfiguredCoreApi({ APP_ENV: "unknown" });
    const response = await app.request("/v1/session", {}, { APP_ENV: "unknown" });
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("CONFIGURATION_INVALID");
  });
  it("registers real consent mutation and rejects invalid input without granting an ambient cookie authority", async () => {
    const app = createConfiguredCoreApi({ APP_ENV: "local" });
    const response = await app.request(
      "/v1/consents",
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: "untrusted=1" },
        body: "{}",
      },
      { APP_ENV: "local" },
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_INPUT");
  });
});
