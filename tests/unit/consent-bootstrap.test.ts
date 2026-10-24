import { describe, expect, it, vi } from "vitest";
import {
  type ConsentBootstrapDependencies,
  createConsentBootstrapRuntime,
  registerConsentBootstrapRoutes,
} from "../../apps/core-api/src/consent-bootstrap";
import { consentBootstrapSchema } from "../../packages/contracts/src/consent-bootstrap";
import { type DatabaseClient, inTransaction } from "../../packages/database/src/client";
import { loadApprovedPrivacyPolicyInTransaction } from "../../packages/database/src/consent-bootstrap";
import { createService } from "../../packages/server/src/index";
import { customerFixture, now } from "./identity-fixtures";

const text = "SYNTHETIC TEST ONLY\n  exact whitespace — മലയാളം\n";
async function fixture() {
  const { identity, authority } = customerFixture();
  authority.consents = [];
  const sha256 = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))),
  )
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  const row = {
    policy_text: text,
    revision: "synthetic-r1",
    policy_sha256: sha256,
    approval_reference: "synthetic-approval",
    approved_at: "2020-01-01T00:00:00Z",
    revoked_at: null,
  };
  const currentPolicy = {
    privacy_version: authority.privacyVersion,
    approval_reference: row.approval_reference,
  };
  const query = vi.fn(async (sql: string) => {
    if (sql.startsWith("SELECT privacy_version"))
      return {
        rows: [currentPolicy],
      };
    if (sql.includes("FROM core.identity_privacy_policy_text")) return { rows: [row] };
    return { rows: [], command: sql === "COMMIT" ? "COMMIT" : sql };
  });
  const client = { query } as unknown as DatabaseClient;
  const dependencies: ConsentBootstrapDependencies = {
    verifySession: vi.fn(async () => ({ status: "verified" as const, identity })),
    withClient: (callback) => callback(client),
    now: () => now,
    loadCurrentAuthorityInTransaction: vi.fn(async (current) => {
      expect(current).toBe(client);
      expect(inTransaction(current)).toBe(true);
      return authority;
    }),
    // Trust-port contract fixture ONLY. Does not prove canonical preprivacy eligibility.
    evaluateEligibility: vi.fn(() => ({ allowed: true as const })),
  };
  const app = createService("core-api", undefined, {
    registerRoutes: (app) =>
      registerConsentBootstrapRoutes(app, createConsentBootstrapRuntime(dependencies)),
  });
  const get = () => app.request("/v1/consent-bootstrap", {}, { APP_ENV: "local" });
  return { identity, authority, row, query, client, dependencies, get };
}

describe("consent bootstrap strict contract and trusted composition ports", () => {
  it("returns exact text and minimal identity, using supplied loader in same transaction", async () => {
    const f = await fixture();
    const response = await f.get();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(consentBootstrapSchema.safeParse(body).success).toBe(true);
    expect(body).toEqual({
      actorId: f.identity.actorId,
      sessionId: f.identity.sessionId,
      expiresAt: f.identity.expiresAt,
      requirement: {
        purpose: "privacy",
        version: f.authority.privacyVersion,
        actorId: f.identity.actorId,
      },
      policy: {
        text,
        revision: f.row.revision,
        sha256: f.row.policy_sha256,
        approvalReference: f.row.approval_reference,
      },
    });
    expect(consentBootstrapSchema.safeParse({ ...body, workspaces: ["customer"] }).success).toBe(
      false,
    );
    expect(
      consentBootstrapSchema.safeParse({
        ...body,
        requirement: { ...body.requirement, purpose: "marketing" },
      }).success,
    ).toBe(false);
    expect(f.query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
  });

  it.each([401, 403, 503] as const)(
    "propagates canonical eligibility denial %s without reading text",
    async (status) => {
      const f = await fixture();
      f.dependencies.evaluateEligibility = () =>
        status === 401
          ? { allowed: false, status, code: "UNAUTHENTICATED" }
          : status === 403
            ? { allowed: false, status, code: "FORBIDDEN" }
            : { allowed: false, status, code: "IDENTITY_UNAVAILABLE" };
      expect((await f.get()).status).toBe(status);
      expect(f.query.mock.calls.some(([sql]) => sql.includes("identity_privacy_policy_text"))).toBe(
        false,
      );
    },
  );

  it.each(["unauthenticated", "unavailable"] as const)(
    "does not load authority for %s verifier",
    async (status) => {
      const f = await fixture();
      f.dependencies.verifySession = async () => ({ status });
      expect((await f.get()).status).toBe(status === "unauthenticated" ? 401 : 503);
      expect(f.dependencies.loadCurrentAuthorityInTransaction).not.toHaveBeenCalled();
    },
  );

  it("rejects already-granted current privacy and never writes consent", async () => {
    const f = await fixture();
    f.authority.consents = customerFixture().authority.consents;
    expect((await f.get()).status).toBe(403);
    expect(f.query.mock.calls.some(([sql]) => /INSERT|UPDATE|DELETE/.test(sql))).toBe(false);
  });

  it.each(["revoked", "hash", "future", "version"])(
    "fails closed on %s policy and rolls back",
    async (kind) => {
      const f = await fixture();
      if (kind === "revoked") Object.assign(f.row, { revoked_at: "2020-01-02T00:00:00Z" });
      if (kind === "hash") f.row.policy_sha256 = "0".repeat(64);
      if (kind === "future") f.row.approved_at = "2100-01-01T00:00:00Z";
      if (kind === "version") f.authority.privacyVersion = "changed-after-load";
      expect((await f.get()).status).toBe(503);
      expect(f.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
    },
  );

  it("requires a platform transaction even for an approved policy", async () => {
    const f = await fixture();
    await expect(
      loadApprovedPrivacyPolicyInTransaction(f.client, f.authority.privacyVersion, now),
    ).rejects.toThrow("transaction");
  });
});
