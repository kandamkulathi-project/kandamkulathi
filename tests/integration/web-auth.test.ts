import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createIdentityRuntime,
  registerIdentityRuntimeRoutes,
} from "../../apps/core-api/src/identity-runtime";
import {
  createWebAuthRuntime,
  registerWebAuthRoutes,
  type WebAuthOptions,
} from "../../apps/core-api/src/web-auth";
import type { DatabaseClient, DatabaseContext } from "../../packages/database/src/client";
import { transaction } from "../../packages/database/src/client";
import { recordSelfConsent } from "../../packages/database/src/identity";
import { digest, encode64 } from "../../packages/providers/src/workos/oauth";
import { registerIdentityRoutes } from "../../packages/server/src/identity";
import { createService } from "../../packages/server/src/index";
import type { TestFetch } from "../fixtures/fetch";
import { instant, options, workosFixture } from "../unit/workos-fixtures";

interface Harness {
  source: DatabaseClient;
  runtime<T>(role: "core", callback: (context: DatabaseContext) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
const actor = "10000000-0000-4000-8000-000000000001";
const membership = "30000000-0000-4000-8000-000000000001";
const policyTables = [
  "identity_actors",
  "identity_sessions",
  "identity_policy",
  "identity_memberships",
  "identity_patient_links",
  "identity_assignments",
  "identity_consents",
  "identity_self_consultations",
  "identity_web_attempts",
  "identity_web_sessions",
];
const owner = `k_web_owner_${crypto.randomUUID().replace(/-/g, "")}`;
const webOptions: WebAuthOptions = {
  ...options,
  apiOrigin: "https://core.example",
  callbackUrl: "https://core.example/v1/auth/callback",
  returnUrl: "https://app.example/session/return",
  allowedReturnUrls: ["https://app.example/session/return"],
  cookieKey: encode64(new Uint8Array(32).fill(71)),
  attemptTtlSeconds: 120,
  sessionTtlSeconds: 300,
};
const hooks = { approvedBrowserOrigin: (origin: string) => origin === "https://app.example" };
const cookies = (response: Response, name: string) =>
  response.headers
    .getSetCookie()
    .find((value) => value.startsWith(`${name}=`))
    ?.split(";")[0] ?? "";

describe("web AuthKit HTTP + real PostgreSQL 17", () => {
  let db: Harness;
  let clock: number;
  let fixture: Awaited<ReturnType<typeof workosFixture>>;
  let runtime: ReturnType<typeof createWebAuthRuntime>;
  let app: ReturnType<typeof createService>;
  let accessToken: string;
  let tokenUser = "user_test";
  let revokeUnavailable = false;
  let exchangeUnavailable = false;
  const transport = vi.fn<TestFetch>();
  const request = (path: string, init?: RequestInit) =>
    app.request(`${webOptions.apiOrigin}${path}`, init, {
      APP_ENV: "preview",
      RESOURCE_NAMESPACE: "kandamkulathi-preview-web-test",
      PROVIDER_MODE: "stub",
      BROWSER_ALLOWED_ORIGINS: "https://app.example",
    });
  beforeAll(async () => {
    const path = "../platform/support.mjs";
    db = await ((await import(path)) as { testDatabase(): Promise<Harness> }).testDatabase();
    // Apply under a real non-superuser object owner, not the harness superuser.
    await db.source.query(
      `CREATE ROLE ${owner} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
    );
    // This test needs to apply identity SQL under a non-superuser owner. Preserve
    // the journal-created schema (and its dependent foreign keys) under a separate
    // name inside this disposable database, rather than dropping shared objects.
    await db.source.query("ALTER SCHEMA core RENAME TO journal_core_fixture");
    await db.source.query(`CREATE SCHEMA core AUTHORIZATION ${owner}`);
    await db.source.query(`SET ROLE ${owner}`);
    try {
      await db.source.query(
        await readFile(
          new URL("../../packages/database/migrations/0002_mathew_identity.sql", import.meta.url),
          "utf8",
        ),
      );
    } finally {
      await db.source.query("RESET ROLE");
    }
  }, 30000);
  beforeEach(async () => {
    clock = instant;
    tokenUser = "user_test";
    revokeUnavailable = false;
    exchangeUnavailable = false;
    fixture = await workosFixture();
    accessToken = await fixture.token();
    transport.mockReset();
    const original = fixture.transport.getMockImplementation();
    if (!original) throw new Error("Missing fixture transport");
    transport.mockImplementation(async (url, init) => {
      if (String(url).endsWith("/authenticate")) {
        if (exchangeUnavailable) throw new Error("Synthetic lost exchange response");
        return new Response(
          JSON.stringify({
            access_token: accessToken,
            refresh_token: "synthetic-refresh-never-stored",
            user: { id: tokenUser },
          }),
        );
      }
      if (String(url).endsWith("/sessions/revoke")) {
        if (revokeUnavailable) throw new Error("Synthetic provider timeout");
        fixture.revoke();
        return new Response(null, { status: 204 });
      }
      return original(url, init);
    });
    await db.source.query(
      "TRUNCATE core.identity_web_sessions,core.identity_web_attempts,core.identity_sessions,core.identity_memberships,core.identity_consents,core.identity_actors,core.identity_policy CASCADE",
    );
    // Real owner policy must allow approved provisioning with FORCE RLS enabled.
    await db.source.query(`SET ROLE ${owner}`);
    try {
      await db.source.query(
        "INSERT INTO core.identity_actors(id,provider_user_id,status) VALUES ($1,'user_test','active')",
        [actor],
      );
      await db.source.query(
        "INSERT INTO core.identity_policy(singleton,privacy_version,consultation_version,marketing_version,approval_reference) VALUES (true,'privacy-test','consult-test','marketing-test','synthetic-approved-policy')",
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
            validFrom: "2020-01-01T00:00:00.000Z",
            expiresAt: "2100-01-01T00:00:00.000Z",
            revokedAt: null,
          }),
        ],
      );
      const id = "40000000-0000-4000-8000-000000000001";
      await db.source.query(
        "INSERT INTO core.identity_consents(id,actor_id,record) VALUES ($1,$2,$3)",
        [
          id,
          actor,
          JSON.stringify({
            id,
            actorId: actor,
            recordedByActorId: actor,
            purpose: "privacy",
            version: "privacy-test",
            decision: "granted",
            decidedAt: "2026-10-24T09:00:00.000Z",
            expiresAt: null,
            revokedAt: null,
          }),
        ],
      );
    } finally {
      await db.source.query("RESET ROLE");
    }
    runtime = createWebAuthRuntime(
      webOptions,
      (callback) => db.runtime("core", ({ client }) => callback(client)),
      hooks,
      transport,
      () => clock,
    );
    app = createService("core-api", undefined, {
      registerRoutes: (app) => {
        registerWebAuthRoutes(app, runtime);
        registerIdentityRoutes(app, runtime.dependencies);
        const native = createIdentityRuntime(
          options,
          (callback) => db.runtime("core", ({ client }) => callback(client)),
          transport,
          () => clock,
        );
        registerIdentityRuntimeRoutes(
          app,
          { ...native, dependencies: runtime.dependencies },
          {
            verifyMutationRequest: runtime.verifyMutationRequest,
            guard: async (client, request, identity) => {
              await runtime.withWebSessionInTransaction(client, request, identity, async () => {});
            },
          },
        );
      },
    });
  });
  afterAll(async () => {
    if (db) {
      await db.source.query("RESET ROLE");
      // Only this test's generated owner and isolated database objects are touched.
      await db.source.query(`REASSIGN OWNED BY ${owner} TO CURRENT_USER`);
      for (const table of policyTables)
        await db.source.query(`DROP POLICY identity_controlled_owner ON core.${table}`);
      await db.source.query(`DROP OWNED BY ${owner}`);
      await db.source.query(`DROP ROLE ${owner}`);
      await db.close();
    }
  });
  const begin = async (priorCookie?: string) => {
    const response = await request(
      "/v1/auth/authorize",
      priorCookie ? { headers: { cookie: priorCookie } } : undefined,
    );
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location") ?? "");
    return {
      response,
      state: location.searchParams.get("state") ?? "",
      attemptCookie: cookies(response, "__Host-k_auth_attempt"),
      location,
    };
  };
  const finish = async (attempt: Awaited<ReturnType<typeof begin>>) =>
    request(`/v1/auth/callback?code=synthetic_code&state=${attempt.state}`, {
      headers: { cookie: attempt.attemptCookie },
    });
  const login = async () => {
    const attempt = await begin();
    const response = await finish(attempt);
    expect(response.status).toBe(303);
    return { attempt, response, sessionCookie: cookies(response, "__Host-k_session") };
  };
  const securityContext = async (sessionCookie: string) => {
    const response = await request("/v1/security/context", {
      headers: { cookie: sessionCookie, origin: "https://app.example" },
    });
    expect(response.status).toBe(200);
    return (await response.json()) as {
      userId: string;
      sessionId: string;
      csrfToken: string;
      expiresAt: string;
    };
  };
  it("records cookie-session consent only with CSRF and a live in-transaction web fence", async () => {
    const signedIn = await login();
    const security = await securityContext(signedIn.sessionCookie);
    const body = {
      requirement: { actorId: actor, purpose: "marketing", version: "marketing-test" },
      decision: "declined",
    };
    const headers = {
      cookie: signedIn.sessionCookie,
      origin: "https://app.example",
      "content-type": "application/json",
    };
    const denied = await request("/v1/consents", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    expect(denied.status).toBe(403);
    const accepted = await request("/v1/consents", {
      method: "POST",
      headers: { ...headers, "x-csrf-token": security.csrfToken },
      body: JSON.stringify(body),
    });
    expect(accepted.status).toBe(201);
    const verified = await runtime.dependencies.verifySession(
      new Request(`${webOptions.apiOrigin}/v1/session`, { headers }),
    );
    if (verified.status !== "verified") throw new Error("Synthetic web session missing");
    const { verifiedIdentitySchema } = await import("../../packages/contracts/src/identity");
    const identity = verifiedIdentitySchema.parse(verified.identity);
    await expect(
      db.runtime("core", ({ client }) =>
        recordSelfConsent(client, identity, body, clock + 1, async () => {
          throw new Error("Synthetic guard denial");
        }),
      ),
    ).rejects.toThrow("Synthetic guard denial");
    expect(
      (
        await db.source.query(
          "SELECT count(*)::int count FROM core.identity_consents WHERE record->>'purpose'='marketing'",
        )
      ).rows[0]?.count,
    ).toBe(1);
  });
  it("implements exact login/session/context DTOs with PKCE, encrypted cookies and one-use callback", async () => {
    const start = await request("/v1/auth/start", { headers: { origin: "https://app.example" } });
    expect(await start.json()).toEqual({ redirectPath: "/v1/auth/authorize" });
    const signedIn = await login();
    expect(signedIn.response.headers.get("location")).toBe(webOptions.returnUrl);
    for (const header of signedIn.response.headers.getSetCookie()) {
      expect(header).toContain("HttpOnly");
      expect(header).toContain("Secure");
      expect(header).toContain("SameSite=Lax");
      expect(header).not.toContain(accessToken);
      expect(header).not.toContain("user_test");
      expect(header).not.toContain("Domain=");
    }
    const exchangeCall = transport.mock.calls.find(([url]) =>
      String(url).endsWith("/authenticate"),
    );
    const exchangeBody = JSON.parse(String(exchangeCall?.[1]?.body));
    expect(await digest(exchangeBody.code_verifier)).toBe(
      signedIn.attempt.location.searchParams.get("code_challenge"),
    );
    expect(exchangeBody.redirect_uri).toBe(webOptions.callbackUrl);
    const session = await request("/v1/session", { headers: { cookie: signedIn.sessionCookie } });
    expect(await session.json()).toEqual({
      userId: actor,
      expiresAt: "2026-10-24T10:05:00.000Z",
      workspaces: ["customer"],
    });
    expect(session.headers.get("cache-control")).toBe("no-store");
    const context = await securityContext(signedIn.sessionCookie);
    expect(Object.keys(context).sort()).toEqual(["csrfToken", "expiresAt", "sessionId", "userId"]);
    const mutation = new Request(`${webOptions.apiOrigin}/v1/orders`, {
      method: "POST",
      headers: {
        cookie: signedIn.sessionCookie,
        origin: "https://app.example",
        "x-csrf-token": context.csrfToken,
      },
    });
    expect(
      await runtime.verifyMutationRequest(mutation, {
        actorId: context.userId,
        sessionId: context.sessionId,
      }),
    ).toBe("allowed");
    expect(
      await runtime.verifyMutationRequest(mutation, {
        actorId: actor,
        sessionId: "20000000-0000-4000-8000-000000000099",
      }),
    ).toBe("denied");
    expect((await finish(signedIn.attempt)).status).toBe(401);
    const stored = await db.source.query(
      "SELECT access_token_ciphertext FROM core.identity_web_sessions",
    );
    expect(stored.rows[0]?.access_token_ciphertext).not.toContain(accessToken);
    expect(JSON.stringify(stored.rows)).not.toContain("synthetic-refresh-never-stored");
  });
  it("rejects state/browser substitution, duplicate callback parameters, open redirects and stale replaced attempts", async () => {
    const first = await begin();
    const second = await begin(first.attemptCookie);
    expect(
      (await db.source.query("SELECT browser_hash FROM core.identity_web_attempts")).rowCount,
    ).toBe(1);
    expect((await finish(first)).status).toBe(401);
    expect(
      (
        await request(`/v1/auth/callback?code=x&state=${second.state}&state=${second.state}`, {
          headers: { cookie: second.attemptCookie },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(`/v1/auth/callback?code=x&state=${second.state}`, {
          headers: { cookie: "__Host-k_auth_attempt=forged" },
        })
      ).status,
    ).toBe(401);
    expect((await request("/v1/auth/authorize?returnTo=https://evil.example")).status).toBe(403);
    expect((await finish(second)).status).toBe(303);
    expect(
      transport.mock.calls.filter(([url]) => String(url).endsWith("/authenticate")),
    ).toHaveLength(1);
  });
  it("rejects expired attempts and expired/revoked/tampered local sessions", async () => {
    const attempt = await begin();
    clock += 120000;
    expect((await finish(attempt)).status).toBe(401);
    expect(transport).not.toHaveBeenCalled();
    clock = instant;
    const signedIn = await login();
    expect(
      (await request("/v1/session", { headers: { cookie: `${signedIn.sessionCookie}tampered` } }))
        .status,
    ).toBe(401);
    clock = instant + 300000;
    expect(
      (await request("/v1/session", { headers: { cookie: signedIn.sessionCookie } })).status,
    ).toBe(401);
  });
  it("denies CSRF/origin/ambiguous credentials without an effect; native bearer helper remains separate", async () => {
    const signedIn = await login();
    const context = await securityContext(signedIn.sessionCookie);
    for (const extra of [
      { origin: "https://evil.example", "x-csrf-token": context.csrfToken },
      { origin: "https://app.example" },
      {
        authorization: `Bearer ${accessToken}`,
        origin: "https://app.example",
        "x-csrf-token": context.csrfToken,
      },
    ]) {
      const request = new Request(`${webOptions.apiOrigin}/v1/orders`, {
        method: "POST",
        headers: { cookie: signedIn.sessionCookie, ...extra },
      });
      expect(
        await runtime.verifyMutationRequest(request, {
          actorId: actor,
          sessionId: context.sessionId,
        }),
      ).toBe("denied");
    }
    expect(
      (
        await request("/v1/security/context", {
          headers: { cookie: signedIn.sessionCookie, origin: "https://evil.example" },
        })
      ).status,
    ).toBe(403);
    expect(
      (await db.source.query("SELECT revoked_at FROM core.identity_web_sessions")).rows[0]
        ?.revoked_at,
    ).toBeNull();
  });
  it("revokes local and actual provider sessions and replays only the exact logout idempotency key", async () => {
    const signedIn = await login();
    const context = await securityContext(signedIn.sessionCookie);
    const headers = {
      cookie: signedIn.sessionCookie,
      origin: "https://app.example",
      "x-csrf-token": context.csrfToken,
      "content-type": "application/json",
      "idempotency-key": "synthetic-logout-0001",
    };
    const response = await request("/v1/session/logout", { method: "POST", headers, body: "{}" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revoked: true });
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(
      (await request("/v1/session", { headers: { cookie: signedIn.sessionCookie } })).status,
    ).toBe(401);
    expect(
      (await request("/v1/session/logout", { method: "POST", headers, body: "{}" })).status,
    ).toBe(200);
    expect(
      (
        await request("/v1/session/logout", {
          method: "POST",
          headers: { ...headers, "idempotency-key": "synthetic-logout-other" },
          body: "{}",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await db.source.query(
          "SELECT revoked_at,revocation_pending FROM core.identity_web_sessions",
        )
      ).rows[0],
    ).toMatchObject({ revocation_pending: false });
    expect(
      (await db.source.query("SELECT revoked_at FROM core.identity_sessions")).rows[0]?.revoked_at,
    ).not.toBeNull();
    expect(
      transport.mock.calls.filter(([url]) => String(url).endsWith("/sessions/revoke")),
    ).toHaveLength(1);
  });
  it("reports pending provider revocation truthfully, clears cookies and can reconcile the same scoped logout retry", async () => {
    const signedIn = await login();
    const context = await securityContext(signedIn.sessionCookie);
    revokeUnavailable = true;
    const headers = {
      cookie: signedIn.sessionCookie,
      origin: "https://app.example",
      "x-csrf-token": context.csrfToken,
      "content-type": "application/json",
      "idempotency-key": "synthetic-logout-pending",
    };
    const response = await request("/v1/session/logout", { method: "POST", headers, body: "{}" });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "LOGOUT_PENDING" } });
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(
      (await request("/v1/session", { headers: { cookie: signedIn.sessionCookie } })).status,
    ).toBe(401);
    expect(
      (await db.source.query("SELECT revocation_pending FROM core.identity_web_sessions")).rows[0]
        ?.revocation_pending,
    ).toBe(true);
    revokeUnavailable = false;
    expect(
      (await request("/v1/session/logout", { method: "POST", headers, body: "{}" })).status,
    ).toBe(200);
  });
  it("consumes uncertain exchanges and does not enroll a mismatched or unapproved account", async () => {
    const lost = await begin();
    exchangeUnavailable = true;
    expect((await finish(lost)).status).toBe(503);
    exchangeUnavailable = false;
    expect((await finish(lost)).status).toBe(401);
    const mismatch = await begin();
    tokenUser = "user_other";
    expect((await finish(mismatch)).status).toBe(401);
    tokenUser = "user_test";
    await db.source.query(
      "UPDATE core.identity_actors SET provider_user_id='user_other' WHERE id=$1",
      [actor],
    );
    expect((await finish(await begin())).status).toBe(403);
    expect((await db.source.query("SELECT id FROM core.identity_sessions")).rowCount).toBe(0);
  });
  it("rolls back enrollment on storage failure while retaining the committed one-use attempt fence", async () => {
    await db.source.query(
      "CREATE FUNCTION core.web_auth_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic rollback'; END $$",
    );
    await db.source.query(
      "CREATE TRIGGER web_auth_test_failure BEFORE INSERT ON core.identity_web_sessions FOR EACH ROW EXECUTE FUNCTION core.web_auth_test_failure()",
    );
    try {
      const attempt = await begin();
      expect((await finish(attempt)).status).toBe(503);
      expect((await finish(attempt)).status).toBe(401);
      expect((await db.source.query("SELECT id FROM core.identity_sessions")).rowCount).toBe(0);
      expect(
        (await db.source.query("SELECT handle_hash FROM core.identity_web_sessions")).rowCount,
      ).toBe(0);
    } finally {
      await db.source.query("DROP TRIGGER web_auth_test_failure ON core.identity_web_sessions");
      await db.source.query("DROP FUNCTION core.web_auth_test_failure()");
    }
  });
  it("holds local/identity session locks through domain commit and resets context on rollback/reuse", async () => {
    const signedIn = await login();
    const req = new Request(`${webOptions.apiOrigin}/v1/orders`, {
      headers: { cookie: signedIn.sessionCookie },
    });
    const verification = await runtime.dependencies.verifySession(req);
    if (verification.status !== "verified") throw new Error("Synthetic login failed");
    const { verifiedIdentitySchema } = await import("../../packages/contracts/src/identity");
    const identity = verifiedIdentitySchema.parse(verification.identity);
    await db.runtime("core", async ({ client }) => {
      await transaction(client, () =>
        runtime.withWebSessionInTransaction(client, req, identity, async (authority) => {
          expect(authority.actorId).toBe(actor);
          await db.source.query("BEGIN");
          try {
            await db.source.query("SET LOCAL lock_timeout='100ms'");
            await expect(
              db.source.query("UPDATE core.identity_web_sessions SET revoked_at=now()"),
            ).rejects.toThrow();
          } finally {
            await db.source.query("ROLLBACK");
          }
        }),
      );
      expect(
        (await client.query("SELECT handle_hash FROM core.identity_web_sessions")).rows,
      ).toEqual([]);
      await expect(
        transaction(client, () =>
          runtime.withWebSessionInTransaction(client, req, identity, async () => {
            throw new Error("rollback");
          }),
        ),
      ).rejects.toThrow("rollback");
      expect((await client.query("SELECT id FROM core.identity_sessions")).rows).toEqual([]);
    });
  });
  it("fails closed without approved configuration or exact redirect policy and keeps runtime out of owner privileges", async () => {
    const disabled = createWebAuthRuntime(
      { ...webOptions, approved: false },
      runtime.withClient,
      hooks,
      transport,
      () => clock,
    );
    expect(await disabled.dependencies.verifySession(new Request(webOptions.apiOrigin))).toEqual({
      status: "unavailable",
    });
    const redirect = createWebAuthRuntime(
      { ...webOptions, returnUrl: "https://evil.example" },
      runtime.withClient,
      hooks,
      transport,
      () => clock,
    );
    expect(await redirect.dependencies.verifySession(new Request(webOptions.apiOrigin))).toEqual({
      status: "unavailable",
    });
    await db.runtime("core", async ({ client }) => {
      expect((await client.query("SELECT id FROM core.identity_actors")).rows).toEqual([]);
      await expect(
        client.query(
          "INSERT INTO core.identity_actors(id,provider_user_id,status) VALUES ($1,'user_forged','active')",
          [crypto.randomUUID()],
        ),
      ).rejects.toThrow();
      expect(
        (await client.query("SELECT pg_has_role(current_user,$1,'MEMBER') AS owns", [owner]))
          .rows[0]?.owns,
      ).toBe(false);
    });
  });
});
