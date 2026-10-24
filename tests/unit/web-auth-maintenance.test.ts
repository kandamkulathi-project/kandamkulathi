import { describe, expect, it, vi } from "vitest";
import {
  createWebAuthMaintenance,
  registerWebAuthAdmission,
} from "../../apps/core-api/src/web-auth-maintenance";
import { encode64 } from "../../packages/providers/src/workos/oauth";
import { createService } from "../../packages/server/src/index";
import type { TestFetch } from "../fixtures/fetch";

const options = {
  approved: true,
  apiKey: "synthetic-provider-key",
  apiOrigin: "https://core.example",
  rateKey: encode64(new Uint8Array(32).fill(32)),
};
describe("web auth admission fail-closed boundary", () => {
  it("never trusts forwarding/actor headers or sends provider traffic without admission", async () => {
    const storage = vi.fn(async () => {
      throw new Error("unexpected database work");
    });
    const provider = vi.fn<TestFetch>();
    const maintenance = createWebAuthMaintenance(
      options,
      {
        withAdmissionClient: storage,
        withMaintenanceClient: storage,
        trustedRemoteAddress: () => null,
      },
      provider,
    );
    const request = new Request("https://core.example/v1/auth/authorize", {
      headers: {
        "x-forwarded-for": "192.0.2.1",
        "x-actor-id": "forged",
        "cf-connecting-ip": "192.0.2.1",
      },
    });
    expect(await maintenance.forRequest(request).admit("authorize")).toBe("unavailable");
    await expect(
      maintenance.forRequest(request).transport("https://api.workos.com/sso/jwks/client_test"),
    ).rejects.toThrow("admission_unavailable");
    expect(storage).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });
  it("defaults unavailable before auth handlers and leaves public catalogue/native paths unchanged", async () => {
    const storage = async () => {
      throw new Error("unexpected database work");
    };
    const maintenance = createWebAuthMaintenance(
      { ...options, approved: false },
      {
        withAdmissionClient: storage,
        withMaintenanceClient: storage,
        trustedRemoteAddress: () => "192.0.2.1",
      },
    );
    let entered = 0;
    const app = createService("core-api", undefined, {
      registerRoutes: (app) => {
        registerWebAuthAdmission(app, maintenance);
        app.get("/v1/auth/start", (context) => {
          entered++;
          return context.json({ unsafe: true });
        });
        app.get("/v1/catalogue", (context) => context.json({ public: true }));
        app.get("/v1/session", (context) => context.json({ native: true }));
      },
    });
    const denied = await app.request("https://core.example/v1/auth/start", undefined, {
      APP_ENV: "local",
    });
    expect(denied.status).toBe(503);
    expect(entered).toBe(0);
    expect(
      (
        await app.request(
          "https://core.example/v1/catalogue",
          { headers: { cookie: "__Host-k_session=opaque" } },
          { APP_ENV: "local" },
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request(
          "https://core.example/v1/session",
          { headers: { authorization: "Bearer native" } },
          { APP_ENV: "local" },
        )
      ).status,
    ).toBe(200);
  });
});
