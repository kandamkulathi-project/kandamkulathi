import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createWebAuthRuntime } from "../../apps/core-api/src/web-auth";
import {
  createWebAuthMaintenance,
  registerWebAuthAdmission,
} from "../../apps/core-api/src/web-auth-maintenance";
import type { DatabaseClient, DatabaseContext } from "../../packages/database/src/client";
import {
  claimPendingLogouts,
  cleanupWebAuth,
  finishLogoutClaim,
  ownsLogoutLease,
} from "../../packages/database/src/web-auth-maintenance";
import { createWebSecrets, digest, encode64 } from "../../packages/providers/src/workos/oauth";
import { createService } from "../../packages/server/src/index";
import type { TestFetch } from "../fixtures/fetch";
import { instant, workosFixture, options as workosOptions } from "../unit/workos-fixtures";

interface Harness {
  source: DatabaseClient;
  runtime<T>(role: "core" | "jobs", callback: (context: DatabaseContext) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
const actor = "10000000-0000-4000-8000-000000000001";
const session = "20000000-0000-4000-8000-000000000001";
const owner = `k_auth_maint_${crypto.randomUUID().replace(/-/g, "")}`;
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
const options = {
  approved: true,
  apiKey: "synthetic-provider-key",
  apiOrigin: "https://core.example",
  rateKey: encode64(new Uint8Array(32).fill(32)),
};

describe("web auth maintenance actual PostgreSQL 17", () => {
  let db: Harness;
  let active: boolean;
  let mode: "normal" | "lost-applied" | "lost-unapplied" | "malformed" | "offline" | "still-active";
  const provider = vi.fn<TestFetch>();
  const factory = (address = "192.0.2.8", fetcher: typeof fetch = provider) =>
    createWebAuthMaintenance(
      options,
      {
        withAdmissionClient: (callback) => db.runtime("core", ({ client }) => callback(client)),
        withMaintenanceClient: (callback) => db.runtime("jobs", ({ client }) => callback(client)),
        trustedRemoteAddress: () => address,
      },
      fetcher,
    );
  beforeAll(async () => {
    const path = "../platform/support.mjs";
    db = await ((await import(path)) as { testDatabase(): Promise<Harness> }).testDatabase();
    await db.source.query(
      `CREATE ROLE ${owner} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
    );
    // Preserve the journal-installed domain objects while applying this owner's
    // exact identity/maintenance migrations in a fresh schema in this disposable DB.
    await db.source.query("ALTER SCHEMA core RENAME TO journal_core_fixture");
    await db.source.query(`CREATE SCHEMA core AUTHORIZATION ${owner}`);
    await db.source.query(`SET ROLE ${owner}`);
    try {
      for (const file of ["0002_mathew_identity.sql", "0007_mathew_web_auth_maintenance.sql"])
        await db.source.query(
          await readFile(
            new URL(`../../packages/database/migrations/${file}`, import.meta.url),
            "utf8",
          ),
        );
    } finally {
      await db.source.query("RESET ROLE");
    }
  }, 30000);
  beforeEach(async () => {
    active = true;
    mode = "normal";
    provider.mockReset();
    provider.mockImplementation(async (url, init) => {
      if (mode === "offline") throw new Error("private provider failure");
      if (String(url).endsWith("/sessions/revoke")) {
        expect(JSON.parse(String(init?.body))).toEqual({ session_id: "session_test" });
        if (mode !== "lost-unapplied" && mode !== "still-active") active = false;
        if (mode === "lost-applied" || mode === "lost-unapplied")
          throw new Error("private uncertain result");
        return new Response(null, { status: 204 });
      }
      return new Response(
        JSON.stringify({
          data: active
            ? [
                {
                  id: "session_test",
                  user_id: mode === "malformed" ? "user_wrong" : "user_test",
                  status: "active",
                  expires_at: "2100-01-01T00:00:00.000Z",
                  ended_at: null,
                },
              ]
            : [],
          list_metadata: { after: null },
        }),
      );
    });
    await db.source.query(
      "TRUNCATE core.identity_web_rate_windows,core.identity_web_sessions,core.identity_web_attempts,core.identity_sessions,core.identity_actors CASCADE",
    );
    await db.source.query(`SET ROLE ${owner}`);
    try {
      await db.source.query(
        "INSERT INTO core.identity_actors(id,provider_user_id,status) VALUES ($1,'user_test','active')",
        [actor],
      );
      await db.source.query(
        "INSERT INTO core.identity_sessions(id,actor_id,provider_user_id,provider_session_id,authenticated_at,expires_at) VALUES ($1,$2,'user_test','session_test','2020-01-01','2100-01-01')",
        [session, actor],
      );
    } finally {
      await db.source.query("RESET ROLE");
    }
  });
  afterAll(async () => {
    if (db) {
      await db.source.query("RESET ROLE");
      await db.source.query(`REASSIGN OWNED BY ${owner} TO CURRENT_USER`);
      for (const table of policyTables)
        await db.source.query(`DROP POLICY identity_controlled_owner ON core.${table}`);
      await db.source.query("DROP POLICY web_rate_owner ON core.identity_web_rate_windows");
      await db.source.query(`DROP OWNED BY ${owner}`);
      await db.source.query(`DROP ROLE ${owner}`);
      await db.close();
    }
  });
  const pending = async (name = "pending") => {
    const hash = await digest(name);
    await db.source.query(
      `INSERT INTO core.identity_web_sessions(handle_hash,actor_id,session_id,access_token_ciphertext,expires_at,revoked_at,revocation_pending,logout_key)
      VALUES ($1,$2,$3,'sealed-synthetic-token',clock_timestamp()-interval '1 hour',clock_timestamp(),true,'synthetic-logout-key')`,
      [hash, actor, session],
    );
    return hash;
  };
  const due = () =>
    db.source.query(
      "UPDATE core.identity_web_sessions SET logout_next_attempt_at=clock_timestamp()-interval '1 second'",
    );
  it("enforces distributed atomic per-IP start caps under real concurrent connections and emits safe HTTP429", async () => {
    const maintenance = factory();
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        maintenance.forRequest(new Request("https://core.example/v1/auth/start")).admit("start"),
      ),
    );
    expect(results.filter((value) => value === "allowed")).toHaveLength(10);
    expect(results.filter((value) => value === "denied")).toHaveLength(10);
    const anotherProcess = factory();
    expect(
      await anotherProcess
        .forRequest(
          new Request("https://core.example/v1/auth/start", {
            headers: { "x-forwarded-for": "192.0.2.99", "x-actor-id": "forged" },
          }),
        )
        .admit("start"),
    ).toBe("denied");
    let entered = 0;
    const app = createService("core-api", undefined, {
      registerRoutes: (app) => {
        registerWebAuthAdmission(app, maintenance);
        app.get("/v1/auth/start", (context) => {
          entered++;
          return context.json({ unsafe: true });
        });
      },
    });
    const response = await app.request("https://core.example/v1/auth/start", undefined, {
      APP_ENV: "local",
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(entered).toBe(0);
    const rows = await db.source.query("SELECT * FROM core.identity_web_rate_windows");
    expect(JSON.stringify(rows.rows)).not.toContain("192.0.2.");
    expect(JSON.stringify(rows.rows)).not.toContain(options.rateKey);
    expect(
      rows.rows.every(
        (row) =>
          new Date(row.expires_at).getTime() - new Date(row.window_start).getTime() === 120000,
      ),
    ).toBe(true);
  }, 30000);
  it("applies a global admission cap before creating new pseudonymous IP rows", async () => {
    expect(
      await factory().forRequest(new Request("https://core.example/v1/auth/start")).admit("start"),
    ).toBe("allowed");
    await db.source.query(
      "UPDATE core.identity_web_rate_windows SET hits=600 WHERE lane='auth-global'",
    );
    for (let index = 10; index < 20; index++)
      expect(
        await factory(`192.0.2.${index}`)
          .forRequest(new Request("https://core.example/v1/auth/start"))
          .admit("start"),
      ).toBe("denied");
    expect(
      (
        await db.source.query(
          "SELECT count(*)::integer AS total FROM core.identity_web_rate_windows WHERE lane='auth-ip'",
        )
      ).rows[0]?.total,
    ).toBe(1);
  });
  it("caps actual provider calls per request, denies unapproved URLs and never calls before admission", async () => {
    const transport = vi.fn<TestFetch>(async () => new Response("{}"));
    const request = factory("192.0.2.8", transport).forRequest(
      new Request("https://core.example/v1/session"),
    );
    await expect(request.transport("https://api.workos.com/sso/jwks/client_test")).rejects.toThrow(
      "admission_unavailable",
    );
    expect(await request.admit("session")).toBe("allowed");
    await expect(request.transport("https://evil.example/steal")).rejects.toThrow(
      "admission_denied",
    );
    for (let index = 0; index < 24; index++)
      await request.transport("https://api.workos.com/sso/jwks/client_test");
    await expect(request.transport("https://api.workos.com/sso/jwks/client_test")).rejects.toThrow(
      "admission_denied",
    );
    expect(transport).toHaveBeenCalledTimes(24);
  }, 30000);
  it("wires the minimal authoritative actor-cap hook before any provider work", async () => {
    const fixture = await workosFixture();
    const token = await fixture.token();
    const handle = encode64(new Uint8Array(32).fill(54));
    const hash = await digest(handle);
    const cookieKey = encode64(new Uint8Array(32).fill(71));
    const secrets = createWebSecrets(cookieKey, options.apiOrigin);
    await db.source.query(
      "INSERT INTO core.identity_web_sessions(handle_hash,actor_id,session_id,access_token_ciphertext,expires_at) VALUES ($1,$2,$3,$4,'2100-01-01')",
      [hash, actor, session, await secrets.seal(token, `provider-token|${hash}`)],
    );
    const cookie = `__Host-k_session=${await secrets.seal(handle, "session-cookie")}`;
    const maintenance = factory("192.0.2.8", fixture.transport);
    const first = maintenance.forRequest(new Request("https://core.example/v1/session"));
    expect(await first.admit("session")).toBe("allowed");
    expect(await first.admitActor(actor)).toBe("allowed");
    await db.source.query(
      "UPDATE core.identity_web_rate_windows SET hits=120 WHERE lane='provider-actor'",
    );
    const req = new Request("https://core.example/v1/session", { headers: { cookie } });
    const gate = maintenance.forRequest(req);
    expect(await gate.admit("session")).toBe("allowed");
    const admitActor = vi.fn((id: string) => gate.admitActor(id));
    const web = createWebAuthRuntime(
      {
        ...workosOptions,
        apiOrigin: options.apiOrigin,
        callbackUrl: `${options.apiOrigin}/v1/auth/callback`,
        returnUrl: "https://app.example/return",
        allowedReturnUrls: ["https://app.example/return"],
        cookieKey,
        attemptTtlSeconds: 120,
        sessionTtlSeconds: 300,
      },
      (callback) => db.runtime("core", ({ client }) => callback(client)),
      { approvedBrowserOrigin: () => false, admitActor },
      gate.transport,
      () => instant,
    );
    expect(await web.dependencies.verifySession(req)).toEqual({ status: "unavailable" });
    expect(admitActor).toHaveBeenCalledWith(actor);
    expect(fixture.transport).not.toHaveBeenCalled();
  });
  it("charges each provider call to the known actor budget and cannot rebind the request", async () => {
    const transport = vi.fn<TestFetch>(async () => new Response("{}"));
    const scope = factory("192.0.2.8", transport).forRequest(
      new Request("https://core.example/v1/session"),
    );
    expect(await scope.admit("session")).toBe("allowed");
    expect(await scope.admitActor(actor)).toBe("allowed");
    expect(await scope.admitActor("10000000-0000-4000-8000-000000000002")).toBe("denied");
    await db.source.query(
      "UPDATE core.identity_web_rate_windows SET hits=119 WHERE lane='provider-actor'",
    );
    await scope.transport("https://api.workos.com/sso/jwks/client_test");
    await expect(scope.transport("https://api.workos.com/sso/jwks/client_test")).rejects.toThrow(
      "admission_denied",
    );
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("leases pending logouts exclusively and fences stale completion after expiry/reclaim", async () => {
    await pending();
    const claims = await Promise.all([
      db.runtime("jobs", ({ client }) => claimPendingLogouts(client)),
      db.runtime("jobs", ({ client }) => claimPendingLogouts(client)),
    ]);
    expect(claims.flat()).toHaveLength(1);
    const first = claims.flat()[0];
    if (!first) throw new Error("missing claim");
    await db.source.query(
      "UPDATE core.identity_web_sessions SET logout_lease_until=clock_timestamp()-interval '1 second'",
    );
    const second = (await db.runtime("jobs", ({ client }) => claimPendingLogouts(client)))[0];
    if (!second) throw new Error("missing reclaimed job");
    expect(second.logout_lease_token).not.toBe(first.logout_lease_token);
    expect(
      await db.runtime("jobs", ({ client }) =>
        finishLogoutClaim(client, first, { complete: true }),
      ),
    ).toBe(false);
    expect(await db.runtime("jobs", ({ client }) => ownsLogoutLease(client, second))).toBe(true);
    expect(
      await db.runtime("jobs", ({ client }) =>
        finishLogoutClaim(client, second, { complete: true }),
      ),
    ).toBe(true);
  });
  it("gives the immediate HTTP revoke a bounded quiet window before Cron pickup", async () => {
    const hash = await pending();
    await db.source.query(
      "UPDATE core.identity_web_sessions SET revocation_pending=false WHERE handle_hash=$1",
      [hash],
    );
    await db.source.query(
      "UPDATE core.identity_web_sessions SET revocation_pending=true WHERE handle_hash=$1",
      [hash],
    );
    expect(await db.runtime("jobs", ({ client }) => claimPendingLogouts(client))).toEqual([]);
    const result = await db.source.query(
      "SELECT logout_next_attempt_at>clock_timestamp() AS delayed,logout_attempts FROM core.identity_web_sessions",
    );
    expect(result.rows[0]).toMatchObject({ delayed: true, logout_attempts: 0 });
    await due();
    expect(await db.runtime("jobs", ({ client }) => claimPendingLogouts(client))).toHaveLength(1);
  });
  it("confirms already-inactive sessions without issuing another revoke and holds no DB locks during provider work", async () => {
    const hash = await pending();
    active = false;
    const original = provider.getMockImplementation();
    if (!original) throw new Error("missing provider");
    provider.mockImplementation(async (url, init) => {
      await db.source.query("BEGIN");
      try {
        await db.source.query("SET LOCAL lock_timeout='100ms'");
        await db.source.query(
          "SELECT handle_hash FROM core.identity_web_sessions WHERE handle_hash=$1 FOR UPDATE NOWAIT",
          [hash],
        );
      } finally {
        await db.source.query("ROLLBACK");
      }
      return original(url, init);
    });
    const result = await factory().runCron();
    expect(result.completed).toBe(1);
    expect(result.pending).toBe(0);
    expect(result.providerCalls).toBe(1);
    expect(provider.mock.calls.some(([url]) => String(url).endsWith("/sessions/revoke"))).toBe(
      false,
    );
    const row = (await db.source.query("SELECT * FROM core.identity_web_sessions")).rows[0];
    expect(row?.revocation_pending).toBe(false);
    expect(row?.provider_revoked_at).not.toBeNull();
    expect(row?.access_token_ciphertext).toBe("purged");
    expect(JSON.stringify(result)).not.toMatch(/user_test|session_test|sealed|Bearer/);
  });
  it("reconciles an applied revoke with a lost reply; never blindly repeats an uncertain POST", async () => {
    await pending();
    mode = "lost-applied";
    const result = await factory().runCron();
    expect(result.completed).toBe(1);
    expect(result.providerCalls).toBe(3);
    expect(
      provider.mock.calls.map(([url]) =>
        String(url).endsWith("/sessions/revoke") ? "POST" : "GET",
      ),
    ).toEqual(["GET", "POST", "GET"]);
    expect((await factory().runCron()).claimed).toBe(0);
  });
  it("does not report completion if its lease expires during a provider call", async () => {
    await pending();
    active = false;
    const original = provider.getMockImplementation();
    if (!original) throw new Error("missing provider");
    provider.mockImplementation(async (url, init) => {
      await db.source.query(
        "UPDATE core.identity_web_sessions SET logout_lease_until=clock_timestamp()-interval '1 second'",
      );
      return original(url, init);
    });
    const result = await factory().runCron();
    expect(result.completed).toBe(0);
    expect(result.stale).toBe(1);
    expect(
      (await db.source.query("SELECT revocation_pending FROM core.identity_web_sessions")).rows[0]
        ?.revocation_pending,
    ).toBe(true);
    provider.mockImplementation(original);
    expect((await factory().runCron()).completed).toBe(1);
  });
  it("retains failed provider work durably with backoff, including after token expiry, and later rechecks state before retry", async () => {
    await pending();
    mode = "lost-unapplied";
    const result = await factory().runCron();
    expect(result.pending).toBe(1);
    expect(result.completed).toBe(0);
    let row = (await db.source.query("SELECT * FROM core.identity_web_sessions")).rows[0];
    expect(row?.revocation_pending).toBe(true);
    expect(row?.logout_last_failure).toBe("provider_still_active");
    expect(row?.access_token_ciphertext).toBe("purged");
    expect(row?.logout_lease_token).toBeNull();
    expect((await factory().runCron()).claimed).toBe(0);
    await due();
    active = false;
    provider.mockClear();
    expect((await factory().runCron()).completed).toBe(1);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(String(provider.mock.calls[0]?.[0])).toContain("/users/user_test/sessions");
    row = (await db.source.query("SELECT * FROM core.identity_web_sessions")).rows[0];
    expect(row?.revocation_pending).toBe(false);
  });
  it.each(["malformed", "offline", "still-active"] as const)(
    "never ACKs provider uncertainty (%s) or leaks credentials",
    async (failure) => {
      await pending();
      mode = failure;
      const result = await factory().runCron();
      expect(result.completed).toBe(0);
      expect(result.pending).toBe(1);
      const row = (
        await db.source.query(
          "SELECT revocation_pending,provider_revoked_at FROM core.identity_web_sessions",
        )
      ).rows[0];
      expect(row?.revocation_pending).toBe(true);
      expect(row?.provider_revoked_at).toBeNull();
      if (failure !== "still-active")
        expect(provider.mock.calls.some(([url]) => String(url).endsWith("/sessions/revoke"))).toBe(
          false,
        );
      expect(JSON.stringify(result)).not.toContain(options.apiKey);
    },
  );
  it("bounds Cron provider work even under deep pagination and retains budget-exhausted duties", async () => {
    for (let index = 0; index < 5; index++) await pending(`budget${index}`);
    provider.mockImplementation(async (url) => {
      if (String(url).endsWith("/sessions/revoke")) return new Response(null, { status: 204 });
      const cursor = new URL(String(url)).searchParams.get("after");
      const page = cursor ? Number(cursor.replace("session_cursor", "")) : 0;
      return new Response(
        JSON.stringify({
          data: [
            {
              id: page === 9 ? "session_test" : `session_other${page}`,
              user_id: "user_test",
              status: "active",
              expires_at: "2100-01-01T00:00:00.000Z",
              ended_at: null,
            },
          ],
          list_metadata: { after: page === 9 ? null : `session_cursor${page + 1}` },
        }),
      );
    });
    const summary = await factory().runCron();
    expect(summary.claimed).toBe(5);
    expect(summary.providerCalls).toBe(48);
    expect(provider).toHaveBeenCalledTimes(48);
    expect(summary.completed).toBe(0);
    expect(summary.pending).toBe(5);
    const rows = await db.source.query(
      "SELECT revocation_pending,logout_last_failure FROM core.identity_web_sessions",
    );
    expect(rows.rows.every((row) => row.revocation_pending)).toBe(true);
    expect(rows.rows.some((row) => row.logout_last_failure === "budget_exhausted")).toBe(true);
  }, 30000);
  it("bounded TTL cleanup removes only expired attempts/counters and completed old sessions, purges credentials and retains pending duties", async () => {
    await pending("old-pending");
    await db.source.query(
      "UPDATE core.identity_web_sessions SET expires_at=clock_timestamp()-interval '25 hours'",
    );
    for (const name of ["old-complete", "recent-expired", "active"]) {
      const hash = await digest(name);
      const expiry =
        name === "old-complete" ? "-25 hours" : name === "recent-expired" ? "-1 hour" : "1 hour";
      await db.source.query(
        "INSERT INTO core.identity_web_sessions(handle_hash,actor_id,session_id,access_token_ciphertext,expires_at) VALUES ($1,$2,$3,'sealed-synthetic-token',clock_timestamp()+$4::interval)",
        [hash, actor, session, expiry],
      );
    }
    const hashes = await Promise.all(
      Array.from({ length: 105 }, (_, index) => digest(`attempt${index}`)),
    );
    await db.source.query(
      "INSERT INTO core.identity_web_attempts(browser_hash,state_hash,verifier_ciphertext,expires_at) SELECT value,value,'sealed-verifier',clock_timestamp()-interval '1 second' FROM unnest($1::text[]) value",
      [hashes],
    );
    for (const stale of [true, false])
      await db.source.query(
        `INSERT INTO core.identity_web_rate_windows(bucket_hash,lane,window_start,hits,expires_at)
      SELECT $1,'start',date_trunc('minute',clock_timestamp())-$2::interval,1,date_trunc('minute',clock_timestamp())-$2::interval+interval '2 minutes'`,
        [
          await digest(stale ? "expired-window" : "active-window"),
          stale ? "3 minutes" : "0 minutes",
        ],
      );
    const first = await db.runtime("jobs", ({ client }) => cleanupWebAuth(client, 100));
    expect(first.attempts).toBe(100);
    expect(first.windows).toBe(1);
    expect(
      (await db.source.query("SELECT bucket_hash FROM core.identity_web_rate_windows")).rowCount,
    ).toBe(1);
    expect(first.sessions).toBe(1);
    expect(
      (await db.source.query("SELECT browser_hash FROM core.identity_web_attempts")).rowCount,
    ).toBe(5);
    const rows = await db.source.query("SELECT * FROM core.identity_web_sessions");
    expect(rows.rowCount).toBe(3);
    expect(rows.rows.find((row) => row.revocation_pending)?.access_token_ciphertext).toBe("purged");
    const activeHash = await digest("active");
    expect(rows.rows.find((row) => row.handle_hash === activeHash)?.access_token_ciphertext).toBe(
      "sealed-synthetic-token",
    );
    expect((await db.runtime("jobs", ({ client }) => cleanupWebAuth(client, 100))).attempts).toBe(
      5,
    );
  });
});
