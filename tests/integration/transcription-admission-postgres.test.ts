import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  registerTranscriptionRoutes,
  type TranscriptionRuntime,
} from "../../apps/core-api/src/transcription";
import { nativeTranscription } from "../../apps/mobile/src/transcription";
import type { DatabaseClient, DatabaseContext } from "../../packages/database/src/client";
import { transaction } from "../../packages/database/src/client";
import { loadCurrentAuthorityInTransaction } from "../../packages/database/src/identity";
import { guardNativeSession } from "../../packages/database/src/native-auth";
import {
  type TranscriptionTicket,
  transcriptionAdmission,
} from "../../packages/database/src/transcription-admission";
import {
  createTranscriptionProvider,
  transcriptionEndpoint,
} from "../../packages/providers/src/transcription";
import { digest } from "../../packages/providers/src/workos/oauth";
import { createService } from "../../packages/server/src/index";
import { transcriptionBindings, transcriptionInput } from "../fixtures/transcription";
import { customerFixture, ids } from "../unit/identity-fixtures";

interface Fixture {
  source: Pick<DatabaseClient, "query">;
  admin: Pick<DatabaseClient, "query">;
  runtime<T>(role: "core", work: (context: DatabaseContext) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
let fixture: Fixture;
const base = customerFixture();
const from = new Date(Date.now() - 3600000).toISOString();
const until = new Date(Date.now() + 3600000).toISOString();
const identity = { ...base.identity, authenticatedAt: from, expiresAt: until };
const credential = "n1_synthetic_transcription";
const version = transcriptionBindings.TRANSCRIPTION_PROCESSING_POLICY_VERSION;
const owner = `k_test_transcription_${randomBytes(7).toString("hex")}`;
const ticket = (): TranscriptionTicket => ({
  actorId: ids.actor,
  operationId: randomUUID(),
  fence: randomUUID(),
  policyVersion: version,
});
const withClient: TranscriptionRuntime["identity"]["withClient"] = (work) =>
  fixture.runtime("core", ({ client }) => work(client));

async function command(action: Parameters<typeof transcriptionAdmission>[1], input = ticket()) {
  return withClient((client) =>
    transaction(client, async () => {
      await client.query("SELECT set_config('identity.actor_id',$1,true)", [ids.actor]);
      return transcriptionAdmission(client, action, input);
    }),
  );
}
async function provision(limit: number, concurrency: number) {
  // Test-only owner setup, never a runtime API or migration seed.
  await fixture.source.query(
    `INSERT INTO core.transcription_capabilities
    (actor_id,approved_by,approval_reference,processing_policy_version,active,valid_from,expires_at,lifetime_limit,max_concurrent,lease_seconds)
    VALUES($1,$1,'synthetic-isolated-approval',$2,true,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',$3,$4,25)
    ON CONFLICT(actor_id) DO UPDATE SET active=true,processing_policy_version=EXCLUDED.processing_policy_version,
      valid_from=EXCLUDED.valid_from,expires_at=EXCLUDED.expires_at,lifetime_limit=EXCLUDED.lifetime_limit,max_concurrent=EXCLUDED.max_concurrent`,
    [ids.actor, version, limit, concurrency],
  );
}
async function journal() {
  return (
    await fixture.source.query(
      `SELECT operation_id,completed_at IS NOT NULL AS completed FROM core.transcription_admissions WHERE actor_id=$1 ORDER BY admitted_at`,
      [ids.actor],
    )
  ).rows;
}

function app(
  transport: Parameters<typeof createTranscriptionProvider>[1],
  options: { unauthenticated?: boolean; denied?: boolean; failCleanup?: boolean } = {},
) {
  let transactions = 0;
  const runtime: TranscriptionRuntime = {
    identity: {
      now: Date.now,
      withClient: (work) => {
        if (++transactions === 4 && options.failCleanup)
          throw new Error("Synthetic cleanup connection failure");
        return withClient(work);
      },
    },
    dependencies: {
      now: Date.now,
      verifySession: async () =>
        options.unauthenticated ? { status: "unauthenticated" } : { status: "verified", identity },
      loadCurrentAuthority: () =>
        withClient((client) =>
          transaction(client, () => loadCurrentAuthorityInTransaction(client, identity)),
        ),
    },
    mutation: async () => (options.denied ? "denied" : "allowed"),
    async withSessionInTransaction(client, request, principal, work) {
      // Synthetic provider verification seam; canonical DB identity and native-handle guard are real.
      expect(request.headers.get("authorization")).toBe(`Bearer ${credential}`);
      const authority = await loadCurrentAuthorityInTransaction(client, principal);
      await guardNativeSession(client, await digest(credential), principal, Date.now());
      return work(authority);
    },
  };
  return createService("core-api", () => {}, {
    registerRoutes(service) {
      registerTranscriptionRoutes(
        service,
        runtime,
        createTranscriptionProvider(transcriptionBindings, transport),
      );
    },
  });
}
const upload = (service: ReturnType<typeof app>, input: unknown = transcriptionInput()) =>
  service.fetch(
    new Request("http://localhost/v1/transcription", {
      method: "POST",
      headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
    { APP_ENV: "local" },
  );

describe("transcription admission — real PostgreSQL, canonical DB/native guards and Core HTTP", () => {
  beforeAll(async () => {
    const supportPath = "../platform/support.mjs";
    fixture = await (await import(supportPath)).testDatabase();
    // Disposable test database only: preserve the journal-installed core (including 0030)
    // and execute exact identity/native/admission SQL in a fresh owner-controlled core.
    // This tests SECURITY DEFINER + FORCE RLS without reapplying CREATEs to installed tables
    // or changing CURRENT_USER policies/ownership on the journal's existing objects.
    await fixture.admin.query(
      `CREATE ROLE ${owner} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
    );
    await fixture.source.query("ALTER SCHEMA core RENAME TO journal_core_fixture");
    await fixture.source.query(`CREATE SCHEMA core AUTHORIZATION ${owner}`);
    await fixture.source.query(`SET ROLE ${owner}`);
    try {
      for (const migration of [
        "0002_mathew_identity.sql",
        "0008_mathew_native_auth.sql",
        "0030_transcription_admission.sql",
      ])
        await fixture.source.query(
          await readFile(
            new URL(`../../packages/database/migrations/${migration}`, import.meta.url),
            "utf8",
          ),
        );
    } finally {
      await fixture.source.query("RESET ROLE");
    }
    // The source admin needs the same explicit owner policy, not a runtime privilege.
    await fixture.source.query(
      `INSERT INTO core.identity_actors(id,provider_user_id,status) VALUES($1,'user_Transcription','active')`,
      [ids.actor],
    );
    await fixture.source.query(`INSERT INTO core.identity_policy(privacy_version,consultation_version,marketing_version,approval_reference)
      VALUES('privacy-v1','consultation-v1','marketing-v1','synthetic')`);
    await fixture.source.query(
      `INSERT INTO core.identity_sessions(id,actor_id,provider_user_id,provider_session_id,authenticated_at,expires_at)
      VALUES($1,$2,'user_Transcription','session_Transcription',$3,$4)`,
      [ids.session, ids.actor, from, until],
    );
    await fixture.source.query(
      `INSERT INTO core.identity_consents(id,actor_id,record) VALUES($1,$2,$3::jsonb)`,
      [ids.other, ids.actor, JSON.stringify({ ...base.authority.consents[0], decidedAt: from })],
    );
    await fixture.source.query(
      `INSERT INTO core.identity_native_sessions(handle_hash,actor_id,session_id,provider_user_id,provider_session_id,access_ciphertext,expires_at)
      VALUES($1,$2,$3,'user_Transcription','session_Transcription','synthetic-unused',$4)`,
      [await digest(credential), ids.actor, ids.session, until],
    );
  }, 60000);
  afterAll(async () => {
    if (!fixture) return;
    try {
      await fixture.source.query("RESET ROLE");
      // Only this disposable harness's replacement schema/generated owner are removed.
      await fixture.source.query("DROP SCHEMA core CASCADE");
      await fixture.source.query(`DROP OWNED BY ${owner}`);
      await fixture.admin.query(`DROP ROLE ${owner}`);
    } finally {
      await fixture.close();
    }
  });

  it("denies absent/unapproved/stale/expired capabilities before provider dispatch", async () => {
    let calls = 0;
    const service = app(async () => {
      calls++;
      return Response.json({ text: "synthetic" });
    });
    expect((await upload(service)).status).toBe(503);
    await provision(10, 1);
    for (const change of [
      "active=false",
      "processing_policy_version='stale'",
      "expires_at=clock_timestamp()-interval '1 second'",
      "expires_at=clock_timestamp()+interval '10 seconds'",
    ]) {
      await fixture.source.query(`UPDATE core.transcription_capabilities SET ${change}`);
      expect((await upload(service)).status).toBe(503);
      await provision(10, 1);
    }
    expect(calls).toBe(0);
    expect(await journal()).toEqual([]);
    expect(
      (
        await upload(
          app(
            async () => {
              throw new Error("must not dispatch");
            },
            { unauthenticated: true },
          ),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await upload(
          app(
            async () => {
              throw new Error("must not dispatch");
            },
            { denied: true },
          ),
        )
      ).status,
    ).toBe(403);
    expect(
      (await upload(service, { ...transcriptionInput(), processingPolicyVersion: "stale" })).status,
    ).toBe(403);
    expect((await upload(service, { ...transcriptionInput(), action: "send" })).status).toBe(400);
    expect(await journal()).toEqual([]);
  });

  it("serializes concurrent HTTP admissions, commits usage before dispatch, and exhausts lifetime quota", async () => {
    await provision(2, 1);
    let entered!: () => void;
    const dispatched = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let finish!: () => void;
    const waiting = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let calls = 0;
    const service = app(async () => {
      calls++;
      expect(await journal()).toHaveLength(1); // Other connection sees COMMITTED reservation.
      entered();
      await waiting;
      return Response.json({ text: "synthetic review" });
    });
    const first = upload(service);
    try {
      await dispatched;
      const competitors = await Promise.all([upload(service), upload(service), upload(service)]);
      expect(competitors.map((response) => response.status)).toEqual([429, 429, 429]);
      expect(calls).toBe(1);
    } finally {
      finish();
    }
    expect((await first).status).toBe(200);
    expect((await journal()).map((row) => row.completed)).toEqual([true]);
    const second = app(async () => {
      calls++;
      return new Response(null, { status: 429 });
    });
    expect((await upload(second)).status).toBe(429);
    expect((await upload(second)).status).toBe(429);
    expect(calls).toBe(2);
    expect((await journal()).map((row) => row.completed)).toEqual([true, true]);
    await fixture.source.query(
      "UPDATE core.transcription_capabilities SET processing_policy_version='changed'",
    );
    await provision(2, 1);
    expect((await upload(second)).status).toBe(429); // Version changes cannot reset usage.
  });

  it("retains unknown and expired slots; only explicit owner reconciliation allows recovery without refund", async () => {
    await provision(5, 1);
    let calls = 0;
    const service = app(async () => {
      calls++;
      throw new Error("synthetic uncertain completion");
    });
    expect((await upload(service)).status).toBe(503);
    expect((await upload(service)).status).toBe(429);
    expect(calls).toBe(1);
    const unresolved = (await journal()).filter((row) => !row.completed);
    expect(unresolved).toHaveLength(1);
    const operation = unresolved[0]?.operation_id;
    // Test-only time passage, not a production reclaim path.
    await fixture.source.query(
      "UPDATE core.transcription_admissions SET admitted_at=clock_timestamp()-interval '1 minute',lease_until=clock_timestamp()-interval '1 second' WHERE operation_id=$1",
      [operation],
    );
    expect((await upload(service)).status).toBe(503);
    expect(calls).toBe(1);
    await fixture.source.query(
      "UPDATE core.transcription_admissions SET completed_at=clock_timestamp(),reconciliation_reference='synthetic-quiescence-evidence',fence=$2 WHERE operation_id=$1",
      [operation, randomUUID()],
    );
    const success = app(async () => {
      calls++;
      return Response.json({ text: "synthetic recovered" });
    });
    expect((await upload(success)).status).toBe(200);
    expect(await journal()).toHaveLength(4); // Reconciliation never refunds lifetime usage.
  });

  it("fences wrong tokens/replay/late completion and rolls back quota on an uncommitted reservation", async () => {
    await provision(10, 1);
    const input = ticket();
    expect(await command("reserve", input)).toBe("admitted");
    expect(await command("reserve", input)).toBe("denied");
    expect(await command("complete", { ...input, fence: randomUUID() })).toBe("unknown");
    expect(await command("reserve")).toBe("rate-limited");
    await fixture.source.query(
      "UPDATE core.transcription_admissions SET admitted_at=clock_timestamp()-interval '1 minute',lease_until=clock_timestamp()-interval '1 second' WHERE operation_id=$1",
      [input.operationId],
    );
    expect(await command("complete", input)).toBe("unknown");
    expect(await command("reserve")).toBe("unknown");
    await fixture.source.query(
      "UPDATE core.transcription_admissions SET completed_at=clock_timestamp(),reconciliation_reference='synthetic-reconciled',fence=$2 WHERE operation_id=$1",
      [input.operationId, randomUUID()],
    );
    expect(await command("complete", input)).toBe("unknown");
    const before = (await journal()).length;
    await expect(
      withClient((client) =>
        transaction(client, async () => {
          await client.query("SELECT set_config('identity.actor_id',$1,true)", [ids.actor]);
          expect(await transcriptionAdmission(client, "reserve", ticket())).toBe("admitted");
          throw new Error("synthetic rollback");
        }),
      ),
    ).rejects.toThrow("synthetic rollback");
    expect(await journal()).toHaveLength(before);
  });

  it("runs capture → actual loopback HTTP → durable PostgreSQL admission → editable review, then denies exhausted quota", async () => {
    const before = (await journal()).length;
    await provision(before + 1, 1);
    let calls = 0;
    const service = app(async () => {
      calls++;
      return Response.json({ text: "Synthetic editable review" });
    });
    const paths: string[] = [];
    const server = createServer(async (incoming, outgoing) => {
      const parts: Buffer[] = [];
      for await (const part of incoming) parts.push(Buffer.from(part));
      paths.push(incoming.url ?? "");
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers))
        if (typeof value === "string") headers.set(name, value);
      const response = await service.fetch(
        new Request(`http://localhost${incoming.url}`, {
          method: "POST",
          headers,
          body: Buffer.concat(parts),
        }),
        { APP_ENV: "local" },
      );
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Loopback unavailable");
    let draft = "";
    let state = "idle";
    let discarded = 0;
    const controller = nativeTranscription({
      origin: `http://127.0.0.1:${address.port}`,
      local: true,
      current: () => true,
      credential: () => credential,
      changed: (value) => {
        state = value;
      },
      review: (text) => {
        draft = text;
      },
      capture: {
        permission: async () => true,
        prepare: async () => {},
        record: () => {},
        stop: async () => {},
        encoded: async () => transcriptionInput().audio,
        discard: async () => {
          discarded++;
        },
      },
    });
    try {
      await controller.start();
      await controller.stop();
      expect(paths).toEqual([]);
      await controller.transcribe(version);
      expect(state).toBe("review");
      expect(draft).toBe("Synthetic editable review");
      draft = "User corrected draft";
      await controller.start();
      await controller.stop();
      await controller.transcribe(version);
      expect(state).toBe("rate-limited");
      expect(draft).toBe("User corrected draft");
      expect(calls).toBe(1);
      expect(discarded).toBe(2);
      expect(paths).toEqual(["/v1/transcription", "/v1/transcription"]); // Never Companion send.
      expect(await journal()).toHaveLength(before + 1);
    } finally {
      await controller.invalidate();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("keeps failed settlement blocking instead of presenting a review or reusing the slot", async () => {
    await provision(10, 1);
    const service = app(
      async () => Response.json({ text: "must not escape after failed cleanup" }),
      { failCleanup: true },
    );
    const response = await upload(service);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("must not escape");
    const blocked = await upload(
      app(async () => {
        throw new Error("must not dispatch");
      }),
    );
    expect(blocked.status).toBe(429);
    const unresolved = (await journal()).filter((row) => !row.completed);
    expect(unresolved).toHaveLength(1);
    // Owner has evidence the synthetic response finished; no quota refund.
    await fixture.source.query(
      "UPDATE core.transcription_admissions SET completed_at=clock_timestamp(),reconciliation_reference='synthetic-finished-response',fence=$2 WHERE operation_id=$1",
      [unresolved[0]?.operation_id, randomUUID()],
    );
  });

  it("rechecks approval and current privacy after external work without leaking text or refunding use", async () => {
    await provision(10, 1);
    const before = (await journal()).length;
    const revoked = app(async () => {
      await fixture.source.query("UPDATE core.transcription_capabilities SET active=false");
      return Response.json({ text: "must not escape" });
    });
    const denied = await upload(revoked);
    expect(denied.status).toBe(503);
    expect(await denied.text()).not.toContain("must not escape");
    await provision(10, 1);
    const privacy = app(async () => {
      await fixture.source.query("DELETE FROM core.identity_consents WHERE actor_id=$1", [
        ids.actor,
      ]);
      return Response.json({ text: "must not escape" });
    });
    const consentDenied = await upload(privacy);
    expect(consentDenied.status).toBe(403);
    expect(await consentDenied.text()).not.toContain("must not escape");
    expect(await journal()).toHaveLength(before + 2);
    expect((await journal()).slice(-2).map((row) => row.completed)).toEqual([true, true]);
  });

  it("enforces FORCE RLS under non-bypass owner and denies runtime provisioning/reset/lease edits", async () => {
    const roles = await fixture.source.query(
      "SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=$1",
      [owner],
    );
    expect(roles.rows).toEqual([{ rolsuper: false, rolbypassrls: false }]);
    const tables = await fixture.source.query(
      "SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid IN ('core.transcription_capabilities'::regclass,'core.transcription_admissions'::regclass)",
    );
    expect(tables.rows).toEqual([
      { relrowsecurity: true, relforcerowsecurity: true },
      { relrowsecurity: true, relforcerowsecurity: true },
    ]);
    await fixture.source.query(`SET ROLE ${owner}`);
    try {
      expect(
        (await fixture.source.query("SELECT actor_id FROM core.transcription_capabilities")).rows,
      ).toHaveLength(1);
    } finally {
      await fixture.source.query("RESET ROLE");
    }
    for (const sql of [
      "SELECT * FROM core.transcription_admissions",
      "UPDATE core.transcription_capabilities SET lifetime_limit=10000",
      "DELETE FROM core.transcription_admissions",
      "UPDATE core.transcription_admissions SET completed_at=clock_timestamp()",
      "INSERT INTO core.transcription_capabilities(actor_id) VALUES(gen_random_uuid())",
      "TRUNCATE core.transcription_admissions",
    ])
      await expect(withClient((client) => client.query(sql))).rejects.toThrow(/permission denied/);
    expect(await command("reserve", { ...ticket(), actorId: ids.patientActor })).toBe("denied");
    expect(
      (
        await fixture.source.query(
          "SELECT has_function_privilege('k_jobs_runtime','core.transcription_admission(text,uuid,uuid,uuid,text)','EXECUTE') AS allowed",
        )
      ).rows,
    ).toEqual([{ allowed: false }]);
  });

  it("uses owner-provided concurrency and rejects values outside technical ceilings", async () => {
    await provision(100, 2);
    const first = ticket();
    const second = ticket();
    expect(await Promise.all([command("reserve", first), command("reserve", second)])).toEqual([
      "admitted",
      "admitted",
    ]);
    expect(await command("reserve")).toBe("rate-limited");
    expect(await command("complete", first)).toBe("released");
    expect(await command("complete", second)).toBe("released");
    for (const change of [
      "lifetime_limit=10001",
      "max_concurrent=5",
      "lease_seconds=24",
      "lease_seconds=301",
    ]) {
      await expect(
        fixture.source.query(`UPDATE core.transcription_capabilities SET ${change}`),
      ).rejects.toThrow(/check constraint/);
    }
  });

  it.each([
    [400, "invalid"],
    [413, "invalid"],
    [415, "invalid"],
    [401, "not-configured"],
    [403, "not-configured"],
    [429, "rate-limited"],
  ] as const)(
    "settles only the rejected HTTP %i provider operation as %s, retaining lifetime usage",
    async (status, expected) => {
      // Restore current synthetic privacy after the earlier revocation case; never bypass guards.
      await fixture.source.query(
        "INSERT INTO core.identity_consents(id,actor_id,record) VALUES($1,$2,$3::jsonb) ON CONFLICT(id) DO UPDATE SET record=EXCLUDED.record",
        [ids.other, ids.actor, JSON.stringify({ ...base.authority.consents[0], decidedAt: from })],
      );
      const before = (await journal()).length;
      await provision(before + 2, 2);
      const other = ticket();
      expect(await command("reserve", other)).toBe("admitted");
      let calls = 0;
      const server = createServer(async (incoming, outgoing) => {
        for await (const _part of incoming) {
          /* Drain only synthetic multipart input, never log it. */
        }
        calls++;
        outgoing.writeHead(status, { "Content-Type": "application/json" });
        outgoing.end('{"error":{"message":"private synthetic provider detail"}}');
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Loopback unavailable");
      const service = app(async (url, init) => {
        expect(url).toBe(transcriptionEndpoint);
        expect(init?.redirect).toBe("error");
        // Test-only transport redirect to an actual loopback HTTP provider stub.
        return fetch(`http://127.0.0.1:${address.port}/v1/audio/transcriptions`, init);
      });
      try {
        const response = await upload(service);
        expect(response.status).toBe(status === 429 ? 429 : 503);
        expect(await response.json()).toEqual({ status: expected });
        const after = await journal();
        expect(after).toHaveLength(before + 2);
        expect(after.find((row) => row.operation_id === other.operationId)?.completed).toBe(false);
        const rejected = after.filter(
          (row) =>
            !after.slice(0, before).some((old) => old.operation_id === row.operation_id) &&
            row.operation_id !== other.operationId,
        );
        expect(rejected).toHaveLength(1);
        expect(rejected[0]?.completed).toBe(true); // Only this unexpired operation/fence is released.
        expect(await command("complete", other)).toBe("released");
        expect((await upload(service)).status).toBe(429); // Both used quota units persist, despite free slots.
        expect(calls).toBe(1); // No implicit retry or second dispatch on exhausted quota.
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
    },
  );

  it.each([500, 503, 200])(
    "retains the exact uncertain lease for provider HTTP %i or invalid successful body",
    async (status) => {
      const before = (await journal()).length;
      await provision(before + 2, 1); // Leave quota available: the unresolved slot must block dispatch.
      let calls = 0;
      const server = createServer(async (incoming, outgoing) => {
        for await (const _part of incoming) {
          /* Synthetic multipart only. */
        }
        calls++;
        outgoing.writeHead(status, { "Content-Type": "application/json" });
        outgoing.end('{"error":"not a transcript"}');
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Loopback unavailable");
      const service = app(async (url, init) => {
        expect(url).toBe(transcriptionEndpoint);
        return fetch(`http://127.0.0.1:${address.port}/v1/audio/transcriptions`, init);
      });
      try {
        const response = await upload(service);
        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({ status: "unknown" });
        const after = await journal();
        expect(after).toHaveLength(before + 1);
        const unresolved = after.filter((row) => !row.completed);
        expect(unresolved).toHaveLength(1);
        expect((await upload(service)).status).toBe(429);
        expect(calls).toBe(1);
        // Test-owner reconciliation only after the synthetic HTTP response is known finished.
        await fixture.source.query(
          "UPDATE core.transcription_admissions SET completed_at=clock_timestamp(),reconciliation_reference='synthetic-stub-quiescence',fence=$2 WHERE operation_id=$1",
          [unresolved[0]?.operation_id, randomUUID()],
        );
        expect(await journal()).toHaveLength(before + 1); // Never refund the lifetime unit.
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
    },
  );
});
