import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createNativeAuthRuntime,
  registerNativeAuthRoutes,
} from "../../apps/core-api/src/native-auth";
import { verifiedIdentitySchema } from "../../packages/contracts/src/identity";
import type { DatabaseClient, DatabaseContext } from "../../packages/database/src/client";
import { transaction } from "../../packages/database/src/client";
import { recordSelfConsent } from "../../packages/database/src/identity";
import {
  claimNativeLogout,
  cleanupNativeAuth,
  finishNativeLogout,
  guardNativeSession,
  nativeContext,
  readNativeSession,
} from "../../packages/database/src/native-auth";
import { digest } from "../../packages/providers/src/workos/oauth";
import { registerIdentityRoutes } from "../../packages/server/src/identity";
import { createService } from "../../packages/server/src/index";
import type { TestFetch } from "../fixtures/fetch";
import { nativeOptions, proof, verifier } from "../unit/native-auth-fixtures";
import { workosFixture } from "../unit/workos-fixtures";

interface Harness {
  source: DatabaseClient;
  runtime<T>(role: "core" | "jobs", callback: (context: DatabaseContext) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
const actor = "10000000-0000-4000-8000-000000000001";
const owner = `k_native_owner_${crypto.randomUUID().replace(/-/g, "")}`;
describe("native HTTP protocol on real PostgreSQL/non-owner RLS", () => {
  let db: Harness;
  let runtime: ReturnType<typeof createNativeAuthRuntime>;
  let app: ReturnType<typeof createService>;
  let jobs: ReturnType<typeof runtime.maintenance>;
  let fixture: Awaited<ReturnType<typeof workosFixture>>;
  let clock: number;
  let token: string;
  let tokenUser: string;
  let lostExchange: boolean;
  let lostRevoke: boolean;
  let actuallyRevoke: boolean;
  let callbacks: number;
  const transport = vi.fn<TestFetch>();
  const core = <T>(callback: (client: DatabaseClient) => Promise<T>) =>
    db.runtime("core", async ({ client }) => {
      callbacks++;
      try {
        return await callback(client);
      } finally {
        callbacks--;
      }
    });
  const worker = <T>(callback: (client: DatabaseClient) => Promise<T>) =>
    db.runtime("jobs", ({ client }) => callback(client));
  const request = (path: string, init?: RequestInit) =>
    app.request(`${nativeOptions.apiOrigin}${path}`, init, { APP_ENV: "local" });
  const post = (operation: string, body: unknown, headers: Record<string, string> = {}) =>
    request(`/v1/native-auth/${operation}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  const signIn = async (state = "s".repeat(43)) => {
    const input = await proof(state);
    expect((await post("start", input)).status).toBe(200);
    const response = await post("exchange", {
      state,
      redirectUri: input.redirectUri,
      code: "synthetic-code",
      codeVerifier: verifier,
    });
    expect(response.status).toBe(200);
    const result = (await response.json()) as { credential: string };
    return result.credential;
  };
  const authenticated = async (credential: string) => {
    const verified = await runtime.dependencies.verifySession(
      new Request(nativeOptions.apiOrigin, { headers: { Authorization: `Bearer ${credential}` } }),
    );
    if (verified.status !== "verified") throw new Error("Synthetic native auth failed");
    return verifiedIdentitySchema.parse(verified.identity);
  };
  beforeAll(async () => {
    const support = "../platform/support.mjs";
    db = await ((await import(support)) as { testDatabase(): Promise<Harness> }).testDatabase();
    // Disposable test database only: apply both identity and native migrations under
    // a real non-superuser owner to prove SECURITY DEFINER + FORCE RLS behavior.
    await db.source.query(
      `CREATE ROLE ${owner} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
    );
    await db.source.query("ALTER SCHEMA core RENAME TO journal_core_fixture");
    await db.source.query(`CREATE SCHEMA core AUTHORIZATION ${owner}`);
    await db.source.query(`SET ROLE ${owner}`);
    try {
      for (const migration of [
        "0002_mathew_identity.sql",
        "0008_mathew_native_auth.sql",
        "0027_native_expired_logout.sql",
      ])
        await db.source.query(
          await readFile(
            new URL(`../../packages/database/migrations/${migration}`, import.meta.url),
            "utf8",
          ),
        );
    } finally {
      await db.source.query("RESET ROLE");
    }
  }, 30000);
  afterAll(async () => {
    if (!db) return;
    // Only this harness's isolated schema and generated owner are removed.
    await db.source.query("RESET ROLE");
    await db.source.query("DROP SCHEMA core CASCADE");
    await db.source.query(`DROP OWNED BY ${owner}`);
    await db.source.query(`DROP ROLE ${owner}`);
    await db.close();
  });
  beforeEach(async () => {
    clock = Date.now();
    callbacks = 0;
    lostExchange = false;
    lostRevoke = false;
    actuallyRevoke = true;
    tokenUser = "user_test";
    fixture = await workosFixture();
    token = await fixture.token({
      iat: Math.floor(clock / 1000) - 60,
      exp: Math.floor(clock / 1000) + 300,
      padding: "x".repeat(2200),
    });
    transport.mockReset();
    transport.mockImplementation(async (url, init) => {
      expect(callbacks).toBe(0); // No provider call holds ANY request DB transaction/client.
      if (String(url).endsWith("/authenticate")) {
        if (lostExchange) throw new Error("Synthetic uncertain exchange");
        return new Response(
          JSON.stringify({
            access_token: token,
            refresh_token: "never-client-or-database",
            user: { id: tokenUser },
          }),
        );
      }
      if (String(url).endsWith("/sessions/revoke")) {
        if (actuallyRevoke) fixture.revoke();
        if (lostRevoke) throw new Error("Synthetic uncertain revoke");
        return new Response(null, { status: 204 });
      }
      return fixture.transport(url, init);
    });
    await db.source.query(
      "TRUNCATE core.identity_native_attempts,core.identity_native_sessions,core.identity_native_rates,core.identity_sessions,core.identity_consents,core.identity_memberships,core.identity_actors,core.identity_policy CASCADE",
    );
    await db.source.query(`SET ROLE ${owner}`);
    try {
      await db.source.query("INSERT INTO core.identity_actors VALUES($1,'user_test','active')", [
        actor,
      ]);
      await db.source.query(
        "INSERT INTO core.identity_policy VALUES(true,'privacy-test','consult-test','marketing-test','synthetic-approval-only')",
      );
      await db.source.query(
        "INSERT INTO core.identity_memberships(id,actor_id,record) VALUES($1,$2,$3)",
        [
          "30000000-0000-4000-8000-000000000001",
          actor,
          JSON.stringify({
            id: "30000000-0000-4000-8000-000000000001",
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
    } finally {
      await db.source.query("RESET ROLE");
    }
    runtime = createNativeAuthRuntime(nativeOptions, core, transport, () => clock);
    jobs = runtime.maintenance(worker);
    app = createService("core-api", () => {}, {
      registerRoutes(app) {
        registerIdentityRoutes(app, runtime.dependencies);
        registerNativeAuthRoutes(app, runtime, jobs);
      },
    });
  });

  it("exchanges real S256 into a 46-char opaque handle even for a >2048-byte cryptographically signed JWT; consent is still required", async () => {
    expect(token.length).toBeGreaterThan(2048);
    const credential = await signIn();
    expect(credential).toMatch(/^n1_[A-Za-z0-9_-]{43}$/);
    expect(credential.length).toBeLessThanOrEqual(2048);
    const rows = await db.source.query("SELECT * FROM core.identity_native_sessions");
    expect(JSON.stringify(rows.rows)).not.toContain(token);
    expect(JSON.stringify(rows.rows)).not.toContain("never-client-or-database");
    expect(rows.rows[0].access_ciphertext).toMatch(/^v1\./);
    const response = await request("/v1/session", {
      headers: { Authorization: `Bearer ${credential}` },
    });
    expect(response.status).toBe(403); // NEVER invent a preprivacy ClientSession.
    const identity = await authenticated(credential);
    await core((client) =>
      recordSelfConsent(
        client,
        identity,
        {
          requirement: { purpose: "privacy", actorId: actor, version: "privacy-test" },
          decision: "granted",
        },
        clock,
        () =>
          runtime.withNativeSessionInTransaction(
            client,
            new Request(nativeOptions.apiOrigin, {
              headers: { Authorization: `Bearer ${credential}` },
            }),
            identity,
            async () => {},
          ),
      ),
    );
    const ready = await request("/v1/session", {
      headers: { Authorization: `Bearer ${credential}` },
    });
    expect(ready.status).toBe(200);
    expect(await ready.json()).toEqual({
      userId: actor,
      expiresAt: identity.expiresAt,
      workspaces: ["customer"],
    });
    expect(ready.headers.get("cache-control")).toBe("no-store");
  });
  it("binds exact environment/redirect/S256 and consumes state exactly once under concurrent exchanges", async () => {
    const input = await proof();
    expect((await post("start", input)).status).toBe(200);
    expect((await post("start", input)).status).toBe(409);
    const exchange = {
      state: input.state,
      redirectUri: input.redirectUri,
      code: "code",
      codeVerifier: verifier,
    };
    expect(
      (
        await post("exchange", {
          ...exchange,
          redirectUri: "kandamkulathi-local://auth/return?x=1",
        })
      ).status,
    ).toBe(403);
    expect((await post("exchange", { ...exchange, codeVerifier: "z".repeat(43) })).status).toBe(
      401,
    );
    const replies = await Promise.all([post("exchange", exchange), post("exchange", exchange)]);
    expect(replies.map((reply) => reply.status).sort()).toEqual([200, 401]);
    expect(
      transport.mock.calls.filter(([url]) => String(url).endsWith("/authenticate")),
    ).toHaveLength(1);
    expect((await post("exchange", exchange)).status).toBe(401);
  });
  it("commits consumption before an uncertain provider outcome and never exchanges that code again", async () => {
    const input = await proof();
    await post("start", input);
    lostExchange = true;
    const body = {
      state: input.state,
      redirectUri: input.redirectUri,
      code: "code",
      codeVerifier: verifier,
    };
    expect((await post("exchange", body)).status).toBe(503);
    lostExchange = false;
    expect((await post("exchange", body)).status).toBe(401);
    expect(
      transport.mock.calls.filter(([url]) => String(url).endsWith("/authenticate")),
    ).toHaveLength(1);
    expect(
      (await db.source.query("SELECT consumed_at FROM core.identity_native_attempts")).rows[0]
        .consumed_at,
    ).not.toBeNull();
  });
  it("denies expired attempts without provider I/O; a rolled-back consumption stays available", async () => {
    const input = await proof();
    await post("start", input);
    const stateHash = await digest(input.state);
    await expect(
      core((client) =>
        transaction(client, async () => {
          const consumed = await client.query(
            "SELECT core.native_auth_consume($1,$2,$3) consumed",
            [stateHash, input.redirectUri, input.codeChallenge],
          );
          expect(consumed.rows[0].consumed).toBe(true);
          throw new Error("synthetic rollback");
        }),
      ),
    ).rejects.toThrow("rollback");
    expect(
      (await db.source.query("SELECT consumed_at FROM core.identity_native_attempts")).rows[0]
        .consumed_at,
    ).toBeNull();
    await db.source.query(
      "UPDATE core.identity_native_attempts SET expires_at=clock_timestamp()-interval '1 second'",
    );
    expect(
      (
        await post("exchange", {
          state: input.state,
          redirectUri: input.redirectUri,
          code: "code",
          codeVerifier: verifier,
        })
      ).status,
    ).toBe(401);
    expect(transport).not.toHaveBeenCalled();
  });
  it("denies a forged signature, cross-user response and unknown/disabled actor without creating actors or grants", async () => {
    const valid = token;
    token = `${token.slice(0, -10)}xxxxxxxxxx`;
    let input = await proof();
    await post("start", input);
    expect(
      (
        await post("exchange", {
          state: input.state,
          redirectUri: input.redirectUri,
          code: "code",
          codeVerifier: verifier,
        })
      ).status,
    ).toBe(401);
    token = valid;
    tokenUser = "user_other";
    input = await proof("t".repeat(43));
    await post("start", input);
    expect(
      (
        await post("exchange", {
          state: input.state,
          redirectUri: input.redirectUri,
          code: "code",
          codeVerifier: verifier,
        })
      ).status,
    ).toBe(401);
    tokenUser = "user_test";
    await db.source.query("UPDATE core.identity_actors SET status='disabled'");
    input = await proof("u".repeat(43));
    await post("start", input);
    expect(
      (
        await post("exchange", {
          state: input.state,
          redirectUri: input.redirectUri,
          code: "code",
          codeVerifier: verifier,
        })
      ).status,
    ).toBe(403);
    expect(
      (await db.source.query("SELECT count(*)::int n FROM core.identity_sessions")).rows[0].n,
    ).toBe(0);
    expect(
      (await db.source.query("SELECT count(*)::int n FROM core.identity_actors")).rows[0].n,
    ).toBe(1);
  });
  it("rejects Cookie+Authorization, Origin, extra fields, oversized JSON, query strings and invalid logout without provider calls", async () => {
    for (const headers of [
      { Cookie: "x=1" },
      { Origin: "https://core.example" },
      { Authorization: "Bearer x" },
    ])
      expect((await post("start", await proof(), headers)).status).toBe(403);
    expect((await post("start", { ...(await proof()), role: "admin" })).status).toBe(400);
    expect((await post("start", { state: "x".repeat(5000) })).status).toBe(400);
    expect(
      (
        await request("/v1/native-auth/start?state=secret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
    ).toBe(400);
    expect((await post("logout", {})).status).toBe(400);
    expect(
      (await post("logout", { actorId: actor }, { "Idempotency-Key": "k".repeat(32) })).status,
    ).toBe(400);
    expect(transport).not.toHaveBeenCalled();
  });
  describe("rate caps within one authoritative PostgreSQL minute", () => {
    let windowStart: Date;
    beforeEach(async () => {
      // The production cap intentionally resets at the DB's minute boundary.
      // Arrange at least 25s of the real bucket for the 20s aggregate test; never
      // replace the DB clock or make a cross-window denial assertion.
      const result = await db.source.query(
        "SELECT (60-extract(second FROM clock_timestamp()))::float8 remaining",
      );
      const remaining = result.rows[0].remaining as number;
      if (remaining < 25) await db.source.query("SELECT pg_sleep($1)", [remaining + 0.1]);
      windowStart = (await db.source.query("SELECT date_trunc('minute',clock_timestamp()) bucket"))
        .rows[0].bucket as Date;
    }, 30000);
    // This aggregate correctness check makes 30 sequential HTTP starts, each opening
    // two real PostgreSQL connections through the WebSocket proxy, before testing
    // denial. Budget that I/O on shared CI; the default 10s is not a response SLA.
    it("uses fixed-cardinality durable rate caps, including every provider HTTPS call", async () => {
      // A saturated *previous* bucket must admit in the current minute. This is
      // legitimate rollover, not a bypass of the current-window provider cap below.
      await db.source.query(
        "INSERT INTO core.identity_native_rates VALUES('provider',$1::timestamptz-interval '1 minute',240)",
        [windowStart],
      );
      expect(
        (await core((client) => client.query("SELECT core.native_auth_admit('provider') allowed")))
          .rows[0].allowed,
      ).toBe(true);
      expect(
        (await db.source.query("SELECT window_start,hits FROM core.identity_native_rates")).rows,
      ).toEqual([{ window_start: windowStart, hits: 1 }]);
      await db.source.query("DELETE FROM core.identity_native_rates");
      for (let index = 0; index < 30; index++)
        expect((await post("start", await proof(String(index).padStart(43, "s")))).status).toBe(
          200,
        );
      expect((await post("start", await proof("x".repeat(43)))).status).toBe(429);
      await db.source.query(
        "INSERT INTO core.identity_native_rates VALUES('provider',date_trunc('minute',clock_timestamp()),240)",
      );
      const input = await proof("0".padStart(43, "s"));
      expect(
        (
          await post("exchange", {
            state: input.state,
            redirectUri: input.redirectUri,
            code: "code",
            codeVerifier: verifier,
          })
        ).status,
      ).toBe(429);
      expect(transport).not.toHaveBeenCalled();
      expect(
        (await db.source.query("SELECT count(*)::int n FROM core.identity_native_rates")).rows[0].n,
      ).toBeLessThanOrEqual(5);
      expect(
        (
          await db.source.query(
            "SELECT bool_and(window_start=$1) same_window FROM core.identity_native_rates",
            [windowStart],
          )
        ).rows[0].same_window,
      ).toBe(true);
    }, 20000);
  });
  it("does not resurrect an expired authoritative session on a second exchange and cannot reset expiry via the runtime role", async () => {
    const credential = await signIn();
    await db.source.query(
      "UPDATE core.identity_sessions SET expires_at=authenticated_at+interval '1 second'",
    );
    const input = await proof("t".repeat(43));
    await post("start", input);
    expect(
      (
        await post("exchange", {
          state: input.state,
          redirectUri: input.redirectUri,
          code: "code",
          codeVerifier: verifier,
        })
      ).status,
    ).toBe(403);
    expect(
      await runtime.dependencies.verifySession(
        new Request(nativeOptions.apiOrigin, {
          headers: { Authorization: `Bearer ${credential}` },
        }),
      ),
    ).toEqual({ status: "unauthenticated" });
    await expect(
      core((client) =>
        client.query(
          "UPDATE core.identity_native_sessions SET expires_at=clock_timestamp()+interval '1 hour'",
        ),
      ),
    ).rejects.toThrow();
    await expect(
      core((client) => client.query("UPDATE core.identity_native_attempts SET consumed_at=NULL")),
    ).rejects.toThrow();
  });

  it("caps attempt/session storage independently of rate windows and serializes concurrent capacity admission", async () => {
    await db.source.query(`INSERT INTO core.identity_native_attempts(state_hash,redirect_uri,challenge,expires_at)
      SELECT lpad(n::text,43,'0'),'kandamkulathi-local://auth/return',repeat('c',43),clock_timestamp()+interval '5 minutes'
      FROM generate_series(1,599) n`);
    const replies = await Promise.all([
      post("start", await proof("x".repeat(43))),
      post("start", await proof("y".repeat(43))),
    ]);
    expect(replies.map((reply) => reply.status).sort()).toEqual([200, 409]);
    expect(
      (await db.source.query("SELECT count(*)::int n FROM core.identity_native_attempts")).rows[0]
        .n,
    ).toBe(600);
    expect(transport).not.toHaveBeenCalled();
    await db.source.query("DELETE FROM core.identity_native_attempts");
    await signIn();
    await db.source.query(`INSERT INTO core.identity_native_sessions(handle_hash,actor_id,session_id,provider_user_id,provider_session_id,access_ciphertext,expires_at)
      SELECT lpad(n::text,43,'0'),s.actor_id,s.session_id,s.provider_user_id,s.provider_session_id,'synthetic-capacity-fixture',s.expires_at
      FROM generate_series(1,4999) n CROSS JOIN (SELECT * FROM core.identity_native_sessions LIMIT 1) s`);
    const before = transport.mock.calls.length;
    expect((await post("start", await proof("z".repeat(43)))).status).toBe(409);
    expect(transport.mock.calls.length).toBe(before);
    expect(
      (await db.source.query("SELECT count(*)::int n FROM core.identity_native_sessions")).rows[0]
        .n,
    ).toBe(5000);
  });

  it("denies unregistered actors and unmapped organizations without implicit enrollment, MFA or grants", async () => {
    await db.source.query("DELETE FROM core.identity_memberships");
    await db.source.query("DELETE FROM core.identity_actors");
    const input = await proof();
    await post("start", input);
    expect(
      (
        await post("exchange", {
          state: input.state,
          redirectUri: input.redirectUri,
          code: "code",
          codeVerifier: verifier,
        })
      ).status,
    ).toBe(403);
    expect(
      (await db.source.query("SELECT count(*)::int n FROM core.identity_actors")).rows[0].n,
    ).toBe(0);
    expect(
      (await db.source.query("SELECT count(*)::int n FROM core.identity_sessions")).rows[0].n,
    ).toBe(0);
    expect(
      (await db.source.query("SELECT count(*)::int n FROM core.identity_memberships")).rows[0].n,
    ).toBe(0);
    token = await fixture.token({
      iat: Math.floor(clock / 1000) - 60,
      exp: Math.floor(clock / 1000) + 300,
      org_id: "org_unmapped",
    });
    transport.mockImplementation(async (url) => {
      if (String(url).endsWith("/authenticate"))
        return new Response(JSON.stringify({ access_token: token, user: { id: "user_test" } }));
      if (String(url).includes("/jwks/")) return fixture.transport(url);
      return new Response(
        JSON.stringify({
          data: [
            {
              id: "session_test",
              user_id: "user_test",
              status: "active",
              organization_id: "org_unmapped",
              expires_at: "2100-01-01T00:00:00Z",
              ended_at: null,
            },
          ],
          list_metadata: { after: null },
        }),
      );
    });
    const second = await proof("t".repeat(43));
    await post("start", second);
    expect(
      (
        await post("exchange", {
          state: second.state,
          redirectUri: second.redirectUri,
          code: "code",
          codeVerifier: verifier,
        })
      ).status,
    ).toBe(403);
  });

  it("requires current identity for live handles, but an actually expired handle can only revoke its bound session and reconcile the same operation", async () => {
    const credential = await signIn();
    const headers = { Authorization: `Bearer ${credential}`, "Idempotency-Key": "k".repeat(32) };
    const before = transport.mock.calls.length;
    expect((await post("logout", {}, { ...headers, Cookie: "browser=ambiguous" })).status).toBe(
      403,
    );
    expect(
      (await post("logout", {}, { ...headers, Authorization: `Bearer n1_${"z".repeat(43)}` }))
        .status,
    ).toBe(401);
    expect(transport.mock.calls.length).toBe(before);
    fixture.revoke();
    expect((await post("logout", {}, headers)).status).toBe(401);
    expect(
      (await db.source.query("SELECT revoked_at FROM core.identity_native_sessions")).rows[0]
        .revoked_at,
    ).toBeNull();
    const count = transport.mock.calls.length;
    clock += 301000;
    expect(
      await runtime.dependencies.verifySession(new Request(nativeOptions.apiOrigin, { headers })),
    ).toEqual({ status: "unauthenticated" });
    expect(transport.mock.calls.length).toBe(count);
    expect(
      transport.mock.calls.filter(([, init]) =>
        String(init?.body).includes('"grant_type":"refresh_token"'),
      ),
    ).toHaveLength(0);
    // Real DB expiry, not only the injected JS clock: access ciphertext may already be purged.
    await db.source.query(
      "UPDATE core.identity_native_sessions SET expires_at=clock_timestamp()-interval '1 second',access_ciphertext='purged'",
    );
    expect(
      await runtime.verifyMutationRequest(new Request(nativeOptions.apiOrigin, { headers }), {
        actorId: actor,
        sessionId: (await db.source.query("SELECT session_id FROM core.identity_native_sessions"))
          .rows[0].session_id,
      }),
    ).toBe("denied");
    const expiredLogout = await post("logout", {}, headers);
    expect(expiredLogout.status).toBe(200);
    expect(await expiredLogout.json()).toEqual({ revoked: true }); // actual provider list is inactive
    expect(
      (await post("logout", {}, { ...headers, "Idempotency-Key": "wrong".repeat(8) })).status,
    ).toBe(401);
    expect((await post("logout", {}, headers)).status).toBe(200);
    expect(
      await runtime.dependencies.verifySession(new Request(nativeOptions.apiOrigin, { headers })),
    ).toEqual({ status: "unauthenticated" });
    expect(
      transport.mock.calls.filter(([url]) => String(url).endsWith("/sessions/revoke")),
    ).toHaveLength(0);
    const persisted = (await db.source.query("SELECT * FROM core.identity_native_sessions"))
      .rows[0];
    expect(persisted.revoked_at).not.toBeNull();
    expect(persisted.pending).toBe(false);
  });
  describe("expired-handle logout with a real authenticated session fixture", () => {
    let credential: string;
    let identity: Awaited<ReturnType<typeof authenticated>>;
    beforeEach(async () => {
      // Session creation/current verification are fixture setup, not part of the
      // logout/reconciliation journey's 10s budget. Both still use real HTTP/PG.
      credential = await signIn();
      identity = await authenticated(credential);
    });
    it("commits local identity revocation before provider I/O; unknown result stays pending and same-key retry reconciles without duplicate revoke", async () => {
      // Expire the actual stored opaque handle while WorkOS remains active. A wrong
      // actor/session/provider binding must fail before any provider effect.
      await db.source.query(
        "UPDATE core.identity_native_sessions SET expires_at=least(to_timestamp($1/1000.0),clock_timestamp())-interval '1 second'",
        [clock],
      );
      const originalHash = await digest(credential);
      await core(async (client) => {
        const denied = await client.query(
          "SELECT core.native_auth_revoke_expired($1,$2,$3,$4) revoked",
          [
            originalHash,
            "10000000-0000-4000-8000-000000000099",
            identity.sessionId,
            await digest("k".repeat(32)),
          ],
        );
        expect(denied.rows[0]?.revoked).toBe(false);
      });
      const originalTransport = transport.getMockImplementation();
      if (!originalTransport) throw new Error("Synthetic transport required");
      let revocationAtProviderEntry: Record<string, unknown> | undefined;
      transport.mockImplementation(async (url, init) => {
        if (String(url).endsWith("/sessions/revoke"))
          revocationAtProviderEntry = (
            await db.source.query(`SELECT n.revoked_at IS NOT NULL native_revoked,
              s.revoked_at IS NOT NULL identity_revoked,n.pending
              FROM core.identity_native_sessions n JOIN core.identity_sessions s ON s.id=n.session_id`)
          ).rows[0];
        return originalTransport(url, init);
      });
      lostRevoke = true;
      const headers = { Authorization: `Bearer ${credential}`, "Idempotency-Key": "k".repeat(32) };
      const response = await post("logout", {}, headers);
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ error: { code: "LOGOUT_PENDING" } });
      expect(revocationAtProviderEntry).toEqual({
        native_revoked: true,
        identity_revoked: true,
        pending: true,
      });
      const persisted = (await db.source.query("SELECT * FROM core.identity_native_sessions"))
        .rows[0];
      expect(persisted.revoked_at).not.toBeNull();
      expect(persisted.pending).toBe(true);
      expect(persisted.access_ciphertext).toBe("purged");
      expect(
        (
          await db.source.query("SELECT revoked_at FROM core.identity_sessions WHERE id=$1", [
            identity.sessionId,
          ])
        ).rows[0].revoked_at,
      ).not.toBeNull();
      expect(
        await runtime.dependencies.verifySession(new Request(nativeOptions.apiOrigin, { headers })),
      ).toEqual({ status: "unauthenticated" });
      expect(
        (await post("logout", {}, { ...headers, "Idempotency-Key": "wrong".repeat(8) })).status,
      ).toBe(401);
      await db.source.query(
        "UPDATE core.identity_native_sessions SET next_attempt_at=clock_timestamp()-interval '1 second'",
      );
      expect((await post("logout", {}, headers)).status).toBe(200);
      expect(
        transport.mock.calls.filter(([url]) => String(url).endsWith("/sessions/revoke")),
      ).toHaveLength(1);
      expect((await post("logout", {}, headers)).status).toBe(200);
    });
  });
  it("does not report logout success if WorkOS still lists an active session", async () => {
    const credential = await signIn();
    actuallyRevoke = false;
    expect(
      (
        await post(
          "logout",
          {},
          { Authorization: `Bearer ${credential}`, "Idempotency-Key": "k".repeat(32) },
        )
      ).status,
    ).toBe(503);
    expect(
      (await db.source.query("SELECT pending FROM core.identity_native_sessions")).rows[0].pending,
    ).toBe(true);
  });
  it("leases pending work once, fences stale CAS and retains pending obligations beyond credential expiry", async () => {
    const credential = await signIn();
    await runtime.localLogout(
      new Request(nativeOptions.apiOrigin, { headers: { Authorization: `Bearer ${credential}` } }),
      "k".repeat(32),
    );
    const hash = await digest(credential);
    const claims = await Promise.all([
      worker((client) => claimNativeLogout(client, hash)),
      worker((client) => claimNativeLogout(client, hash)),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const claim = claims.find((value) => value !== null);
    if (!claim) throw new Error("Claim required");
    await db.source.query(
      "UPDATE core.identity_native_sessions SET lease_until=clock_timestamp()-interval '1 second',expires_at=clock_timestamp()-interval '48 hours'",
    );
    expect(await worker((client) => finishNativeLogout(client, claim, true))).toBe(false);
    await worker(cleanupNativeAuth);
    expect(
      (await db.source.query("SELECT pending FROM core.identity_native_sessions")).rows[0].pending,
    ).toBe(true);
    await jobs.run();
    expect(
      (await db.source.query("SELECT count(*)::int n FROM core.identity_native_sessions")).rows[0]
        .n,
    ).toBe(0);
  });
  it("guards mutations within the same transaction and fences concurrent logout through commit, then rejects stale identity", async () => {
    const credential = await signIn();
    const identity = await authenticated(credential);
    const hash = await digest(credential);
    expect(
      await runtime.verifyMutationRequest(
        new Request(nativeOptions.apiOrigin, {
          headers: { Authorization: `Bearer ${credential}` },
        }),
        identity,
      ),
    ).toBe("allowed");
    expect(
      await runtime.verifyMutationRequest(
        new Request(nativeOptions.apiOrigin, {
          headers: { Authorization: `Bearer ${credential}` },
        }),
        { ...identity, actorId: "10000000-0000-4000-8000-000000000099" },
      ),
    ).toBe("denied");
    let release!: () => void;
    let locked!: () => void;
    const ready = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const effect = core((client) =>
      transaction(client, () =>
        runtime.withNativeSessionInTransaction(
          client,
          new Request(nativeOptions.apiOrigin, {
            headers: { Authorization: `Bearer ${credential}` },
          }),
          identity,
          async () => {
            locked();
            await hold;
          },
        ),
      ),
    );
    await ready;
    const keyHash = await digest("k".repeat(32));
    try {
      // Real concurrent logout times out on the guard's actor lock; no JS sleep oracle.
      await expect(
        core((client) =>
          transaction(client, async () => {
            await client.query("SET LOCAL lock_timeout='100ms'");
            await client.query("SELECT core.native_auth_revoke($1,$2,$3,$4)", [
              hash,
              identity.actorId,
              identity.sessionId,
              keyHash,
            ]);
          }),
        ),
      ).rejects.toThrow("lock timeout");
      expect(
        (await db.source.query("SELECT revoked_at FROM core.identity_native_sessions")).rows[0]
          .revoked_at,
      ).toBeNull();
    } finally {
      release();
    }
    await effect;
    await core((client) =>
      transaction(client, () =>
        client.query("SELECT core.native_auth_revoke($1,$2,$3,$4)", [
          hash,
          identity.actorId,
          identity.sessionId,
          keyHash,
        ]),
      ),
    );
    await expect(
      core((client) =>
        transaction(client, () => guardNativeSession(client, hash, identity, clock)),
      ),
    ).rejects.toThrow("inactive");
    // Transaction-local context never leaks on reuse/rollback.
    const wrongHash = await digest("n1_wrong");
    expect(
      await core((client) => transaction(client, () => readNativeSession(client, wrongHash))),
    ).toBeNull();
    await expect(
      core((client) =>
        transaction(client, async () => {
          await nativeContext(client, "handle", hash);
          throw new Error("rollback");
        }),
      ),
    ).rejects.toThrow("rollback");
    expect(
      (await core((client) => client.query("SELECT * FROM core.identity_native_sessions"))).rows,
    ).toEqual([]);
  });
});
