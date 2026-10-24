import { describe, expect, it } from "vitest";
import { createCoreApi } from "../../apps/core-api/src/identity";
import {
  createIdentityRuntime,
  registerIdentityRuntimeRoutes,
} from "../../apps/core-api/src/identity-runtime";
import { createService } from "../../packages/server/src/index";
import { instant, options, workosFixture } from "../unit/workos-fixtures";

describe("identity runtime HTTP boundary", () => {
  it("never calls storage for a forged bearer; provider outage remains safe 503", async () => {
    const fixture = await workosFixture();
    const runtime = createIdentityRuntime(
      options,
      async () => {
        throw new Error("must not call database");
      },
      fixture.transport,
      () => instant,
    );
    const app = createCoreApi(runtime.dependencies);
    const response = await app.request(
      "/v1/session",
      { headers: { authorization: "Bearer forged", "x-actor-id": "forged" } },
      { APP_ENV: "local" },
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    fixture.transport.mockRejectedValue(new Error("sensitive provider failure"));
    const failure = await app.request(
      "/v1/session",
      { headers: { authorization: `Bearer ${await fixture.token()}` } },
      { APP_ENV: "local" },
    );
    expect(failure.status).toBe(503);
    expect(await failure.text()).not.toContain("sensitive");
  });
  it("rejects cross-origin/cookie consent and invalid bodies without a successful effect", async () => {
    const runtime = createIdentityRuntime(options, async () => {
      throw new Error("must not call database");
    });
    const app = createService("core-api", undefined, {
      registerRoutes: (app) => registerIdentityRuntimeRoutes(app, runtime),
    });
    for (const headers of [{ cookie: "session=x" }, { origin: "https://evil.example" }]) {
      const response = await app.request(
        "/v1/consents",
        { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: "{}" },
        { APP_ENV: "local" },
      );
      expect(response.status).toBe(403);
    }
    const response = await app.request(
      "/v1/consents",
      { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
      { APP_ENV: "local" },
    );
    expect(response.status).toBe(400);
  });
  it("mutation transport denies ambient credentials and scope headers, and fails unavailable on provider/configuration failure", async () => {
    const fixture = await workosFixture();
    const runtime = createIdentityRuntime(
      options,
      async () => {
        throw new Error("Unexpected storage call");
      },
      fixture.transport,
      () => instant,
    );
    const bindings = {
      actorId: "10000000-0000-4000-8000-000000000001",
      sessionId: "20000000-0000-4000-8000-000000000001",
    };
    const bearer = `Bearer ${await fixture.token()}`;
    for (const headers of [
      { authorization: bearer, cookie: "session=x" },
      { authorization: bearer, origin: "https://core.example" },
      { "x-actor-id": bindings.actorId, "x-role": "administrator" },
    ]) {
      expect(
        await runtime.verifyMutationRequest(
          new Request("https://core.example/v1/commerce", { method: "POST", headers }),
          bindings,
        ),
      ).toBe("denied");
    }
    expect(fixture.transport).not.toHaveBeenCalled();
    fixture.transport.mockRejectedValue(new Error("Provider unavailable"));
    const request = new Request("https://core.example/v1/commerce", {
      method: "POST",
      headers: { authorization: bearer },
    });
    expect(await runtime.verifyMutationRequest(request, bindings)).toBe("unavailable");
    const unconfigured = createIdentityRuntime(
      { ...options, approved: false },
      runtime.withClient,
      fixture.transport,
      () => instant,
    );
    expect(await unconfigured.verifyMutationRequest(request, bindings)).toBe("unavailable");
  });
});
