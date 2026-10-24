import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createConsentBootstrapRuntime,
  registerConsentBootstrapRoutes,
} from "../../apps/core-api/src/consent-bootstrap";
import {
  createIdentityRuntime,
  registerIdentityRuntimeRoutes,
} from "../../apps/core-api/src/identity-runtime";
import { createWebAuthRuntime, registerWebAuthRoutes } from "../../apps/core-api/src/web-auth";
import type { DatabaseClient, DatabaseContext } from "../../packages/database/src/client";
import { transaction } from "../../packages/database/src/client";
import { loadApprovedPrivacyPolicyInTransaction } from "../../packages/database/src/consent-bootstrap";
import { loadCurrentAuthorityInTransaction } from "../../packages/database/src/identity";
import { encode64 } from "../../packages/providers/src/workos/oauth";
import { evaluateConsentBootstrapEligibility } from "../../packages/server/src/authorization";
import { registerIdentityRoutes } from "../../packages/server/src/identity";
import { createService } from "../../packages/server/src/index";
import { instant, options, workosFixture } from "../unit/workos-fixtures";

interface Harness {
  source: DatabaseClient;
  runtime<T>(role: "core", callback: (context: DatabaseContext) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
const actor = "10000000-0000-4000-8000-000000000001";
const sessionId = "20000000-0000-4000-8000-000000000001";
const membership = "30000000-0000-4000-8000-000000000001";
const text = "SYNTHETIC FIXTURE — NOT LEGAL COPY\n  preserve whitespace\n";
const version = "synthetic-privacy";
const approval = "synthetic-approval-only";

describe("consent bootstrap real PostgreSQL and signed-provider HTTP", () => {
  let db: Harness;
  beforeAll(async () => {
    const supportPath = "../platform/support.mjs";
    const { testDatabase } = (await import(supportPath)) as { testDatabase(): Promise<Harness> };
    db = await testDatabase();
    // Parent owns journal activation. Apply this owned additive migration only in the
    // isolated fixture if the parent has not yet registered it.
    const exists = await db.source.query(
      "SELECT to_regclass('core.identity_privacy_policy_text') relation",
    );
    if (!exists.rows[0]?.relation)
      await db.source.query(
        await readFile("packages/database/migrations/0009_mathew_consent_bootstrap.sql", "utf8"),
      );
    await db.source.query(
      "INSERT INTO core.identity_actors(id,provider_user_id,status) VALUES ($1,'user_test','active')",
      [actor],
    );
    await db.source.query(
      `INSERT INTO core.identity_sessions(id,actor_id,provider_user_id,provider_session_id,authenticated_at,expires_at)
      VALUES ($1,$2,'user_test','session_test','2026-10-24T09:00:00Z','2026-10-25T10:00:00Z')`,
      [sessionId, actor],
    );
    await db.source.query(
      `INSERT INTO core.identity_policy(singleton,privacy_version,consultation_version,marketing_version,approval_reference)
      VALUES (true,$1,'synthetic-consultation','synthetic-marketing',$2)`,
      [version, approval],
    );
    await db.source.query(
      "INSERT INTO core.identity_memberships(id,actor_id,record) VALUES ($1,$2,$3)",
      [
        membership,
        actor,
        JSON.stringify({
          id: membership,
          workspace: "customer",
          organizationId: null,
          clinicId: null,
          actions: ["workspace:enter"],
          validFrom: "2026-10-24T09:00:00.000Z",
          expiresAt: "2026-10-25T10:00:00.000Z",
          revokedAt: null,
        }),
      ],
    );
  }, 30000);
  afterAll(async () => {
    await db?.close();
  });
  const provision = async () => {
    await db.source.query(
      `INSERT INTO core.identity_privacy_policy_text
      (privacy_version,approval_reference,revision,policy_text,policy_sha256,approved_at)
      VALUES ($1,$2,'synthetic-r1',$3,encode(sha256(convert_to($3,'UTF8')),'hex'),'2026-10-24T09:00:00Z')`,
      [version, approval, text],
    );
  };
  const loadPolicy = () =>
    db.runtime("core", ({ client }) =>
      transaction(client, () => loadApprovedPrivacyPolicyInTransaction(client, version, instant)),
    );

  beforeEach(async () => {
    await db.source.query("DELETE FROM core.identity_consents");
    await db.source.query("UPDATE core.identity_actors SET status='active'");
    await db.source.query(`UPDATE core.identity_sessions SET revoked_at=NULL,
      expires_at='2026-10-25T10:00:00Z',provider_organization_id=NULL,organization_id=NULL,
      mfa_verified_at=NULL,mfa_expires_at=NULL,mfa_evidence_reference=NULL`);
    await db.source.query(`UPDATE core.identity_memberships SET record=record ||
      '{"workspace":"customer","organizationId":null,"clinicId":null}'::jsonb`);
    await db.source.query(
      "UPDATE core.identity_policy SET privacy_version=$1,approval_reference=$2",
      [version, approval],
    );
    await db.source.query("DELETE FROM core.identity_privacy_policy_text");
    await provision();
  });

  it("requires matching approved policy; enforces hash, version, revocation and runtime read-only RLS", async () => {
    await db.source.query("DELETE FROM core.identity_privacy_policy_text");
    await expect(loadPolicy()).rejects.toThrow("unavailable");
    await provision();
    expect((await loadPolicy()).text).toBe(text);
    await expect(
      db.source.query("UPDATE core.identity_privacy_policy_text SET policy_sha256=$1", [
        "0".repeat(64),
      ]),
    ).rejects.toThrow();
    await db.runtime("core", async ({ client }) => {
      await expect(
        client.query("UPDATE core.identity_privacy_policy_text SET policy_text='unauthorized' "),
      ).rejects.toThrow();
      await expect(client.query("DELETE FROM core.identity_privacy_policy_text")).rejects.toThrow();
      await expect(
        client.query(
          "INSERT INTO core.identity_privacy_policy_text(privacy_version) VALUES ('unauthorized')",
        ),
      ).rejects.toThrow();
      await expect(
        transaction(client, () =>
          client.query("UPDATE core.identity_privacy_policy_text SET lock_guard=true"),
        ),
      ).rejects.toThrow();
    });
    await db.source.query("UPDATE core.identity_policy SET approval_reference='different'");
    await expect(loadPolicy()).rejects.toThrow("unavailable");
    await db.source.query("UPDATE core.identity_policy SET approval_reference=$1", [approval]);
    await db.source.query("UPDATE core.identity_privacy_policy_text SET revoked_at=now()");
    await expect(loadPolicy()).rejects.toThrow("unavailable");
    await db.source.query("UPDATE core.identity_privacy_policy_text SET revoked_at=NULL");
    await db.source.query("UPDATE core.identity_policy SET privacy_version='new'");
    await expect(loadPolicy()).rejects.toThrow("changed");
    await db.source.query("UPDATE core.identity_policy SET privacy_version=$1", [version]);
  });

  it("fences policy text revocation through commit, then immediately observes it", async () => {
    await db.runtime("core", ({ client }) =>
      transaction(client, async () => {
        await loadApprovedPrivacyPolicyInTransaction(client, version, instant);
        await db.source.query("BEGIN");
        try {
          await db.source.query("SET LOCAL lock_timeout='100ms'");
          await expect(
            db.source.query("UPDATE core.identity_privacy_policy_text SET revoked_at=now()"),
          ).rejects.toThrow();
        } finally {
          await db.source.query("ROLLBACK");
        }
      }),
    );
  });

  const http = async (organizationId: string | null = null) => {
    const fixture = await workosFixture();
    const transport: typeof fetch = async (input, init) => {
      const response = await fixture.transport(input, init);
      if (!organizationId || String(input).includes("/jwks/")) return response;
      const body = await response.json();
      body.data = body.data.map((session: Record<string, unknown>) => ({
        ...session,
        organization_id: organizationId,
      }));
      return Response.json(body);
    };
    const runtime = createIdentityRuntime(
      options,
      (callback) => db.runtime("core", ({ client }) => callback(client)),
      transport,
      () => instant,
    );
    const bootstrap = createConsentBootstrapRuntime({
      verifySession: runtime.dependencies.verifySession,
      withClient: runtime.withClient,
      now: runtime.now,
      loadCurrentAuthorityInTransaction: (client, identity) =>
        loadCurrentAuthorityInTransaction(client, identity),
      evaluateEligibility: evaluateConsentBootstrapEligibility,
    });
    const app = createService("core-api", undefined, {
      registerRoutes: (app) => {
        registerIdentityRoutes(app, runtime.dependencies);
        registerIdentityRuntimeRoutes(app, runtime);
        registerConsentBootstrapRoutes(app, bootstrap);
      },
    });
    const headers = {
      authorization: `Bearer ${await fixture.token(organizationId ? { org_id: organizationId } : {})}`,
    };
    const get = (path = "/v1/consent-bootstrap") =>
      app.request(path, { headers }, { APP_ENV: "local" });
    return { app, headers, get, bootstrap, revoke: fixture.revoke };
  };

  it("distinguishes missing privacy from account, staff MFA/org, expiry/revocation and session mismatch", async () => {
    const f = await http();
    expect((await f.get("/v1/session")).status).toBe(403);
    expect((await f.get()).status).toBe(200);
    await db.source.query("UPDATE core.identity_actors SET status='disabled'");
    expect((await f.get()).status).toBe(403);
    await db.source.query("UPDATE core.identity_actors SET status='active'");
    await db.source.query(`UPDATE core.identity_memberships SET record=record ||
      '{"workspace":"physician","organizationId":"40000000-0000-4000-8000-000000000001","clinicId":"50000000-0000-4000-8000-000000000001"}'::jsonb`);
    expect((await f.get()).status).toBe(403);
    await db.source.query(
      `UPDATE core.identity_sessions SET provider_organization_id='org_test',organization_id='40000000-0000-4000-8000-000000000001'`,
    );
    // Provider organization mismatch rejects before any bootstrap projection.
    expect((await f.get()).status).toBe(401);
    const staff = await http("org_test");
    expect((await staff.get()).status).toBe(403); // Matching org, missing independent MFA.
    await db.source.query(`UPDATE core.identity_sessions SET mfa_verified_at='2026-10-24T09:00:00Z',
      mfa_expires_at='2026-10-24T11:00:00Z',mfa_evidence_reference='synthetic-step-up'`);
    expect((await staff.get()).status).toBe(200);
    await db.source.query(
      "UPDATE core.identity_sessions SET mfa_expires_at='2026-10-24T09:30:00Z'",
    );
    expect((await staff.get()).status).toBe(403);
    await db.source.query(
      "UPDATE core.identity_sessions SET provider_organization_id=NULL,organization_id=NULL,mfa_verified_at=NULL,mfa_expires_at=NULL,mfa_evidence_reference=NULL",
    );
    await db.source.query(
      `UPDATE core.identity_memberships SET record=record || '{"workspace":"customer","organizationId":null,"clinicId":null}'::jsonb`,
    );
    await db.source.query("UPDATE core.identity_sessions SET revoked_at=now()");
    expect((await f.get()).status).toBe(401);
    await db.source.query(
      "UPDATE core.identity_sessions SET revoked_at=NULL,expires_at='2026-10-24T09:30:00Z'",
    );
    expect((await f.get()).status).toBe(401);
    await db.source.query("UPDATE core.identity_sessions SET expires_at='2026-10-25T10:00:00Z'");
    f.bootstrap.loadCurrentAuthorityInTransaction = async (client, identity) => ({
      ...(await loadCurrentAuthorityInTransaction(client, identity)),
      sessionId: "20000000-0000-4000-8000-000000000002",
    });
    expect((await f.get()).status).toBe(503);
    f.revoke();
    expect((await f.get()).status).toBe(401);
  });

  it("returns explicit HTTP 503 for absent, wrong-approval, revoked or future approved text", async () => {
    const f = await http();
    await db.source.query("DELETE FROM core.identity_privacy_policy_text");
    expect((await f.get()).status).toBe(503);
    await provision();
    await db.source.query("UPDATE core.identity_policy SET approval_reference='changed'");
    expect((await f.get()).status).toBe(503);
    await db.source.query("UPDATE core.identity_policy SET approval_reference=$1", [approval]);
    await db.source.query("UPDATE core.identity_privacy_policy_text SET revoked_at=now()");
    expect((await f.get()).status).toBe(503);
    await db.source.query(
      "UPDATE core.identity_privacy_policy_text SET revoked_at=NULL,approved_at='2100-01-01T00:00:00Z'",
    );
    expect((await f.get()).status).toBe(503);
  });

  it("retains the actual supplied identity fence through the bootstrap transaction", async () => {
    const f = await http();
    f.bootstrap.loadCurrentAuthorityInTransaction = async (client, identity) => {
      const authority = await loadCurrentAuthorityInTransaction(client, identity);
      await db.source.query("BEGIN");
      try {
        await db.source.query("SET LOCAL lock_timeout='100ms'");
        await expect(
          db.source.query("UPDATE core.identity_sessions SET revoked_at=now()"),
        ).rejects.toThrow();
      } finally {
        await db.source.query("ROLLBACK");
      }
      return authority;
    };
    expect((await f.get()).status).toBe(200);
    await db.source.query("UPDATE core.identity_sessions SET revoked_at=now()");
    expect((await f.get()).status).toBe(401);
  });

  it("uses existing explicit POST consent before canonical GET session can succeed", async () => {
    const f = await http();
    expect((await f.get("/v1/session")).status).toBe(403);
    const response = await f.get();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.policy.text).toBe(text);
    expect(Object.keys(body).sort()).toEqual([
      "actorId",
      "expiresAt",
      "policy",
      "requirement",
      "sessionId",
    ]);
    expect((await db.source.query("SELECT id FROM core.identity_consents")).rows).toEqual([]);
    const post = (input: unknown) =>
      f.app.request(
        "/v1/consents",
        {
          method: "POST",
          headers: { ...f.headers, "content-type": "application/json" },
          body: JSON.stringify(input),
        },
        { APP_ENV: "local" },
      );
    expect((await post({ decision: "granted" })).status).toBe(400);
    expect(
      (
        await post({
          requirement: { ...body.requirement, actorId: "10000000-0000-4000-8000-000000000002" },
          decision: "granted",
        })
      ).status,
    ).toBe(403);
    expect(
      (await post({ requirement: { ...body.requirement, version: "stale" }, decision: "granted" }))
        .status,
    ).toBe(409);
    const consent = await f.app.request(
      "/v1/consents",
      {
        method: "POST",
        headers: { ...f.headers, "content-type": "application/json" },
        body: JSON.stringify({ requirement: body.requirement, decision: "granted" }),
      },
      { APP_ENV: "local" },
    );
    expect(consent.status).toBe(201);
    expect((await f.get("/v1/session")).status).toBe(200);
    expect((await f.get()).status).toBe(403);
  });

  it("bootstraps real cookie identity through the actual same-transaction web fence and CSRF consent guard", async () => {
    const fixture = await workosFixture();
    const accessToken = await fixture.token();
    const transport: typeof fetch = async (input, init) =>
      String(input).endsWith("/authenticate")
        ? Response.json({ access_token: accessToken, user: { id: "user_test" } })
        : fixture.transport(input, init);
    const withClient = <T>(callback: (client: DatabaseClient) => Promise<T>) =>
      db.runtime("core", ({ client }) => callback(client));
    const web = createWebAuthRuntime(
      {
        ...options,
        apiOrigin: "https://core.example",
        callbackUrl: "https://core.example/v1/auth/callback",
        returnUrl: "https://app.example/session/return",
        allowedReturnUrls: ["https://app.example/session/return"],
        cookieKey: encode64(new Uint8Array(32).fill(71)),
        attemptTtlSeconds: 120,
        sessionTtlSeconds: 300,
      },
      withClient,
      { approvedBrowserOrigin: (origin) => origin === "https://app.example" },
      transport,
      () => instant,
    );
    const native = createIdentityRuntime(options, withClient, transport, () => instant);
    const bootstrap = createConsentBootstrapRuntime({
      verifySession: web.dependencies.verifySession,
      withClient,
      now: () => instant,
      evaluateEligibility: evaluateConsentBootstrapEligibility,
      loadCurrentAuthorityInTransaction: (client, identity, request) =>
        web.withWebSessionInTransaction(client, request, identity, async (authority) => {
          await db.source.query("BEGIN");
          try {
            await db.source.query("SET LOCAL lock_timeout='100ms'");
            await expect(
              db.source.query("UPDATE core.identity_web_sessions SET revoked_at=now()"),
            ).rejects.toThrow();
          } finally {
            await db.source.query("ROLLBACK");
          }
          return authority;
        }),
    });
    const app = createService("core-api", undefined, {
      registerRoutes: (app) => {
        registerWebAuthRoutes(app, web);
        registerIdentityRoutes(app, web.dependencies);
        registerConsentBootstrapRoutes(app, bootstrap);
        registerIdentityRuntimeRoutes(
          app,
          { ...native, dependencies: web.dependencies },
          {
            verifyMutationRequest: web.verifyMutationRequest,
            guard: async (client, request, identity) => {
              await web.withWebSessionInTransaction(
                client,
                request,
                identity,
                async () => undefined,
              );
            },
          },
        );
      },
    });
    const request = (path: string, init?: RequestInit) =>
      app.request(`https://core.example${path}`, init, {
        APP_ENV: "preview",
        RESOURCE_NAMESPACE: "kandamkulathi-preview-consent-test",
        PROVIDER_MODE: "stub",
        BROWSER_ALLOWED_ORIGINS: "https://app.example",
      });
    const cookie = (response: Response, name: string) =>
      response.headers
        .getSetCookie()
        .find((value) => value.startsWith(`${name}=`))
        ?.split(";")[0] ?? "";
    const start = await request("/v1/auth/authorize");
    expect(start.status).toBe(302);
    const state = new URL(start.headers.get("location") ?? "").searchParams.get("state");
    const callback = await request(`/v1/auth/callback?code=synthetic_code&state=${state}`, {
      headers: { cookie: cookie(start, "__Host-k_auth_attempt") },
    });
    expect(callback.status).toBe(303);
    const headers = { cookie: cookie(callback, "__Host-k_session"), origin: "https://app.example" };
    expect((await request("/v1/session", { headers })).status).toBe(403);
    const response = await request("/v1/consent-bootstrap", { headers });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.policy.text).toBe(text);
    const security = await request("/v1/security/context", { headers });
    expect(security.status).toBe(200);
    const csrf = (await security.json()).csrfToken;
    const input = JSON.stringify({ requirement: body.requirement, decision: "granted" });
    expect(
      (
        await request("/v1/consents", {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: input,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request("/v1/consents", {
          method: "POST",
          headers: { ...headers, "content-type": "application/json", "x-csrf-token": csrf },
          body: input,
        })
      ).status,
    ).toBe(201);
    expect((await request("/v1/session", { headers })).status).toBe(200);
    await db.source.query("UPDATE core.identity_web_sessions SET revoked_at=now()");
    expect((await request("/v1/consent-bootstrap", { headers })).status).toBe(401);
  });
});
