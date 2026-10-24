import { describe, expect, it, vi } from "vitest";
import { createCoreApi } from "../../apps/core-api/src/identity";
import coreApi from "../../apps/core-api/src/index";
import { sessionSchema } from "../../packages/contracts/src/client";
import { errorSchema } from "../../packages/contracts/src/index";
import type { IdentityDependencies } from "../../packages/server/src/identity";
import {
  before,
  customerFixture,
  ids,
  instant,
  now,
  physicianAuthority,
  physicianIdentity,
} from "../unit/identity-fixtures";

function dependencies(overrides: Partial<IdentityDependencies> = {}): IdentityDependencies {
  return {
    verifySession: vi.fn<IdentityDependencies["verifySession"]>(async () => ({
      status: "verified",
      identity: physicianIdentity(),
    })),
    loadCurrentAuthority: vi.fn(async () => physicianAuthority()),
    now: () => now,
    ...overrides,
  };
}
const request = (app: Pick<ReturnType<typeof createCoreApi>, "fetch">, init?: RequestInit) =>
  app.fetch(new Request("http://localhost/v1/session", init), { APP_ENV: "local" });

async function expectDenial(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  const body = errorSchema.parse(await response.json());
  expect(body.error.code).toBe(code);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-request-id")).toBe(body.error.requestId);
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(JSON.stringify(body)).not.toMatch(
    /synthetic-secret|stack|patientActorId|sessionId|Bearer/,
  );
}

describe("Core session HTTP boundary — injected authority is not real provider/storage evidence", () => {
  it.each([
    {},
    { Authorization: "Bearer fabricated", "X-Role": "admin", "X-Clinic-ID": ids.clinic },
    { Cookie: "session=fabricated", "X-Actor-ID": ids.actor, "X-MFA": "true" },
    { "X-Verified-User": ids.actor, "X-Workspaces": "physician,staff" },
  ])("production composition stays unavailable with untrusted credentials %j", async (headers) => {
    await expectDenial(await request(coreApi, { headers }), 503, "IDENTITY_UNAVAILABLE");
  });
  it("returns only the existing minimal session projection after both trusted dependencies succeed", async () => {
    const deps = dependencies();
    const response = await request(createCoreApi(deps));
    expect(response.status).toBe(200);
    expect(sessionSchema.parse(await response.json())).toEqual({
      userId: ids.actor,
      expiresAt: "2026-10-23T11:00:00.000Z",
      workspaces: ["physician"],
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(deps.verifySession).toHaveBeenCalledOnce();
    expect(deps.loadCurrentAuthority).toHaveBeenCalledExactlyOnceWith(physicianIdentity());
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("normalizes verified principal IDs before the authoritative repository lookup", async () => {
    const identity = physicianIdentity();
    const deps = dependencies({
      verifySession: async () => ({
        status: "verified",
        identity: {
          ...identity,
          actorId: identity.actorId.toUpperCase(),
          sessionId: identity.sessionId.toUpperCase(),
          organizationId: identity.organizationId?.toUpperCase() ?? null,
        },
      }),
    });
    const response = await request(createCoreApi(deps));
    expect(response.status).toBe(200);
    expect(deps.loadCurrentAuthority).toHaveBeenCalledExactlyOnceWith(identity);
    expect(sessionSchema.parse(await response.json()).userId).toBe(identity.actorId);
  });
  it("allows a linked customer session without implying staff access or requiring optional marketing", async () => {
    const { identity, authority } = customerFixture();
    const response = await request(
      createCoreApi(
        dependencies({
          verifySession: async () => ({ status: "verified", identity }),
          loadCurrentAuthority: async () => authority,
        }),
      ),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ workspaces: ["customer"] });
  });
  it("does not call storage after a negative or unavailable verifier result", async () => {
    for (const status of ["unauthenticated", "unavailable"] as const) {
      const deps = dependencies({ verifySession: async () => ({ status }) });
      await expectDenial(
        await request(createCoreApi(deps)),
        status === "unauthenticated" ? 401 : 503,
        status === "unauthenticated" ? "UNAUTHENTICATED" : "IDENTITY_UNAVAILABLE",
      );
      expect(deps.loadCurrentAuthority).not.toHaveBeenCalled();
    }
  });
  it.each([undefined, null, {}, { ...physicianIdentity(), role: "admin" }])(
    "does not trust malformed normalized verifier data %j",
    async (identity) => {
      const deps = dependencies({ verifySession: async () => ({ status: "verified", identity }) });
      await expectDenial(await request(createCoreApi(deps)), 503, "IDENTITY_UNAVAILABLE");
      expect(deps.loadCurrentAuthority).not.toHaveBeenCalled();
    },
  );
  it.each(["verifier", "authority"])(
    "sanitizes %s exceptions and genuinely fails unavailable",
    async (source) => {
      const reject = async (): Promise<never> => {
        throw new Error("synthetic-secret provider payload");
      };
      const deps = dependencies(
        source === "verifier" ? { verifySession: reject } : { loadCurrentAuthority: reject },
      );
      await expectDenial(await request(createCoreApi(deps)), 503, "IDENTITY_UNAVAILABLE");
    },
  );
  it.each([null, {}, { ...physicianAuthority(), actorId: ids.other }])(
    "does not turn missing/mismatched authority into successful authentication",
    async (authority) => {
      await expectDenial(
        await request(createCoreApi(dependencies({ loadCurrentAuthority: async () => authority }))),
        503,
        "IDENTITY_UNAVAILABLE",
      );
    },
  );
  it("uses current session expiry/revocation rather than accepting a previously verified credential", async () => {
    for (const state of [{ sessionExpiresAt: instant }, { sessionRevokedAt: before }]) {
      await expectDenial(
        await request(
          createCoreApi(
            dependencies({
              loadCurrentAuthority: async () => ({ ...physicianAuthority(), ...state }),
            }),
          ),
        ),
        401,
        "UNAUTHENTICATED",
      );
    }
  });
  it("returns 403 for revoked membership, missing MFA, disabled account and missing privacy consent", async () => {
    const revoked = physicianAuthority();
    revoked.memberships.forEach((entry) => {
      entry.revokedAt = before;
    });
    for (const deps of [
      dependencies({ loadCurrentAuthority: async () => revoked }),
      dependencies({
        verifySession: async () => ({
          status: "verified",
          identity: { ...physicianIdentity(), mfa: null },
        }),
      }),
      dependencies({
        loadCurrentAuthority: async () => ({ ...physicianAuthority(), accountStatus: "disabled" }),
      }),
      dependencies({
        loadCurrentAuthority: async () => ({ ...physicianAuthority(), consents: [] }),
      }),
    ]) {
      await expectDenial(await request(createCoreApi(deps)), 403, "FORBIDDEN");
    }
  });
  it("reloads current authority on retry and does not cache grants across revocation", async () => {
    const authority = physicianAuthority();
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error("synthetic-secret temporary outage"))
      .mockImplementation(async () => structuredClone(authority));
    const app = createCoreApi(dependencies({ loadCurrentAuthority: loader }));
    await expectDenial(await request(app), 503, "IDENTITY_UNAVAILABLE");
    expect((await request(app)).status).toBe(200);
    authority.memberships.forEach((entry) => {
      entry.revokedAt = instant;
    });
    await expectDenial(await request(app), 403, "FORBIDDEN");
    expect(loader).toHaveBeenCalledTimes(3);
  });
  it("keeps concurrent request identities and authority separate", async () => {
    const physician = physicianIdentity();
    const customer = customerFixture();
    const app = createCoreApi(
      dependencies({
        // Test-only selector inside a dependency, NEVER the production composition.
        verifySession: async (incoming) => ({
          status: "verified",
          identity:
            incoming.headers.get("test-selector") === "customer" ? customer.identity : physician,
        }),
        loadCurrentAuthority: async (identity) => {
          await Promise.resolve();
          return identity.organizationId === null ? customer.authority : physicianAuthority();
        },
      }),
    );
    const results = await Promise.all([
      request(app, { headers: { "test-selector": "customer" } }),
      request(app),
    ]);
    expect(await results[0]?.json()).toMatchObject({ workspaces: ["customer"] });
    expect(await results[1]?.json()).toMatchObject({ workspaces: ["physician"] });
    expect(results[0]?.headers.get("x-request-id")).not.toBe(
      results[1]?.headers.get("x-request-id"),
    );
  });
  it("preserves local credentialed CORS without using origin as authority", async () => {
    const response = await request(coreApi, { headers: { Origin: "http://127.0.0.1:5173" } });
    expect(response.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5173");
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    await expectDenial(response, 503, "IDENTITY_UNAVAILABLE");
    const deniedOrigin = await request(coreApi, {
      headers: { Origin: "https://untrusted.invalid" },
    });
    expect(deniedOrigin.headers.get("access-control-allow-origin")).toBeNull();
    await expectDenial(deniedOrigin, 503, "IDENTITY_UNAVAILABLE");
  });
  it("does not expose unsupported login or session mutation successes", async () => {
    for (const path of ["/v1/session", "/v1/auth/callback"]) {
      const response = await coreApi.fetch(
        new Request(`http://localhost${path}`, { method: "POST", body: "{}" }),
        { APP_ENV: "local" },
      );
      await expectDenial(response, 503, "FEATURE_UNAVAILABLE");
    }
  });
  it("validates persisted consent input before identity and cannot invent an unconfigured success", async () => {
    for (const [body, status, code] of [
      [{}, 400, "INVALID_INPUT"],
      [
        {
          requirement: {
            purpose: "privacy",
            version: "synthetic-v1",
            actorId: "10000000-0000-4000-8000-000000000001",
          },
          decision: "granted",
        },
        503,
        "IDENTITY_UNAVAILABLE",
      ],
    ] as const) {
      const response = await coreApi.fetch(
        new Request("http://localhost/v1/consents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        { APP_ENV: "local" },
      );
      await expectDenial(response, status, code);
    }
  });
});
