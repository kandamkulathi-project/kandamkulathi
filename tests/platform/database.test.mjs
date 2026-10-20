import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { transaction, withDatabase } from "../../packages/database/src/client.ts";
import {
  acquireExecution,
  claimDue,
  enqueue,
  executeClaim,
  probeHandlers,
  publishClaim,
  publishClaims,
} from "../../packages/database/src/outbox.ts";
import { exportEncrypted, restoreEncrypted } from "../../scripts/platform/backup.mjs";
import {
  digest,
  migrate,
  migrationFiles,
  operationTarget,
  withAdmin,
} from "../../scripts/platform/database.mjs";
import { checkCompatibility, withDeploymentLock } from "../../scripts/platform/release.mjs";
import { syntheticFixtures } from "../../scripts/platform/synthetic.mjs";
import { testDatabase } from "./support.mjs";

let fixture;
const job = (overrides = {}) => ({
  id: randomUUID(),
  operationId: randomUUID(),
  channel: "financial",
  kind: "platform.probe",
  subjectId: randomUUID(),
  revision: 1,
  dueAt: new Date(Date.now() - 1000),
  deadlineAt: new Date(Date.now() + 3600000),
  ...overrides,
});
const insert = (input) =>
  fixture.runtime("core", (context) => transaction(context.client, () => enqueue(context, input)));
const receive = async (input, handlers = probeHandlers) =>
  fixture.runtime("jobs", async (context) => {
    const acquired = await acquireExecution(context.client, {
      schemaVersion: 1,
      id: input.id,
      channel: input.channel,
    });
    return typeof acquired === "string" ? acquired : executeClaim(context, acquired, handlers);
  });
const counts = async () =>
  (
    await fixture.source.query(`SELECT
  (SELECT count(*)::int FROM platform.outbox) AS jobs,
  (SELECT count(*)::int FROM platform.receipts) AS receipts,
  (SELECT count(*)::int FROM platform.probe_effects) AS effects`)
  ).rows[0];
before(
  async () => {
    fixture = await testDatabase();
    await fixture.source.query(`CREATE TABLE core.p1_scope_fixture(id uuid PRIMARY KEY, actor_id uuid NOT NULL);
      GRANT USAGE ON SCHEMA core TO k_core_runtime,k_backup_runtime;
      GRANT SELECT,INSERT ON core.p1_scope_fixture TO k_core_runtime;
      GRANT SELECT ON core.p1_scope_fixture TO k_backup_runtime;
      ALTER TABLE core.p1_scope_fixture ENABLE ROW LEVEL SECURITY;
      ALTER TABLE core.p1_scope_fixture FORCE ROW LEVEL SECURITY;
      CREATE POLICY fixture_scope ON core.p1_scope_fixture TO k_core_runtime
        USING (actor_id = nullif(current_setting('app.actor_id',true),'')::uuid)
        WITH CHECK (actor_id = nullif(current_setting('app.actor_id',true),'')::uuid);
      CREATE POLICY fixture_backup ON core.p1_scope_fixture FOR SELECT TO k_backup_runtime USING(true)`);
    await fixture.source.query(`CREATE TABLE platform.p1_authority_fixture(subject_id uuid PRIMARY KEY, revision integer NOT NULL, consent boolean NOT NULL);
      GRANT SELECT,UPDATE(subject_id) ON platform.p1_authority_fixture TO k_jobs_runtime;
      GRANT SELECT ON platform.p1_authority_fixture TO k_backup_runtime;
      ALTER TABLE platform.p1_authority_fixture ENABLE ROW LEVEL SECURITY;
      ALTER TABLE platform.p1_authority_fixture FORCE ROW LEVEL SECURITY;
      CREATE POLICY authority_read ON platform.p1_authority_fixture FOR SELECT TO k_jobs_runtime,k_backup_runtime USING(true);
      CREATE POLICY authority_lock ON platform.p1_authority_fixture FOR UPDATE TO k_jobs_runtime USING(true) WITH CHECK(true)`);
  },
  { timeout: 30000 },
);
beforeEach(async () => {
  await fixture.reset();
});
after(async () => {
  await fixture?.close();
});

test("actual Neon websocket driver verifies non-owner roles and rejects wrong group/environment", async () => {
  assert.equal(
    await fixture.runtime(
      "core",
      async ({ client }) => (await client.query("SELECT current_user AS name")).rows[0].name,
    ),
    new URL(fixture.urls.core).username,
  );
  await assert.rejects(
    withDatabase(fixture.urls.core, "local", "k_jobs_runtime", async () => {}, fixture.localProxy),
    /role or version/,
  );
  await assert.rejects(
    fixture.runtime("core", async () => {}, "kandamkulathi-dev"),
    /environment or API/,
  );
  await assert.rejects(
    fixture.runtime("core", ({ client }) =>
      client.query("CREATE TABLE platform.denied(id integer)"),
    ),
    /permission denied/,
  );
  await assert.rejects(
    fixture.runtime("core", ({ client }) =>
      client.query("INSERT INTO platform.probe_effects(operation_id) VALUES ($1)", [randomUUID()]),
    ),
    /permission denied/,
  );
});

test("runtime refuses combined groups and application database/table ownership", async () => {
  const login = new URL(fixture.urls.core).username;
  const change = async (format, values) =>
    fixture.source.query(
      (
        await fixture.source.query(`SELECT format($1::text,$2::text,$3::text) AS sql`, [
          format,
          ...values,
        ])
      ).rows[0].sql,
    );
  await change("GRANT %I TO %I", ["k_jobs_runtime", login]);
  try {
    await assert.rejects(
      fixture.runtime("core", async () => {}),
      /role or version/,
    );
  } finally {
    await change("REVOKE %I FROM %I", ["k_jobs_runtime", login]);
  }
  await change("ALTER TABLE %s OWNER TO %I", ["platform.probe_effects", login]);
  try {
    await assert.rejects(
      fixture.runtime("core", async () => {}),
      /role or version/,
    );
  } finally {
    await change("ALTER TABLE %s OWNER TO %I", [
      "platform.probe_effects",
      new URL(fixture.sourceUrl).username,
    ]);
  }
  const name = new URL(fixture.sourceUrl).pathname.slice(1);
  await change("ALTER DATABASE %I OWNER TO %I", [name, login]);
  try {
    await assert.rejects(
      fixture.runtime("core", async () => {}),
      /role or version/,
    );
  } finally {
    await change("ALTER DATABASE %I OWNER TO %I", [name, new URL(fixture.sourceUrl).username]);
  }
  await change("GRANT %I TO %I", ["pg_read_server_files", login]);
  try {
    await assert.rejects(
      fixture.runtime("core", async () => {}),
      /role or version/,
    );
  } finally {
    await change("REVOKE %I FROM %I", ["pg_read_server_files", login]);
  }
});

test("atomic enqueue rolls back with its transaction and refuses autocommit", async () => {
  const input = job();
  await assert.rejects(
    fixture.runtime("core", (context) => enqueue(context, input)),
    /transaction boundary/,
  );
  await assert.rejects(
    fixture.runtime("core", (context) =>
      transaction(context.client, async () => {
        await enqueue(context, input);
        throw new Error("synthetic-crash");
      }),
    ),
    /synthetic-crash/,
  );
  assert.deepEqual(await counts(), { jobs: 0, receipts: 0, effects: 0 });
  assert.equal(await insert(input), input.id);
  assert.equal(await insert({ ...input, id: randomUUID() }), input.id);
  await assert.rejects(insert({ ...input, id: randomUUID(), revision: 2 }), /conflicting inputs/);
});

test("FOR UPDATE SKIP LOCKED gives concurrent dispatchers disjoint jobs and excludes future jobs", async () => {
  for (let index = 0; index < 8; index++) await insert(job());
  await insert(job({ dueAt: new Date(Date.now() + 60000) }));
  const [left, right] = await Promise.all([
    fixture.runtime("jobs", ({ client }) => claimDue(client, 4)),
    fixture.runtime("jobs", ({ client }) => claimDue(client, 4)),
  ]);
  assert.equal(left.length + right.length, 8);
  assert.equal(new Set([...left, ...right].map((item) => item.id)).size, 8);
  assert([...left, ...right].every((item) => item.pickupMs >= 1000));
});

test("publish happens after commit; duplicate delivery and a fast consumer produce one effect", async () => {
  const input = job();
  await insert(input);
  await fixture.runtime("jobs", async ({ client }) => {
    const [claim] = await claimDue(client);
    await publishClaim(client, claim, async (_channel, envelope) => {
      const visible = await fixture.source.query("SELECT status FROM platform.outbox WHERE id=$1", [
        envelope.id,
      ]);
      assert.equal(visible.rows[0].status, "dispatching");
      assert.equal(await receive(input), "succeeded");
    });
  });
  assert.equal(await receive(input), "terminal");
  assert.deepEqual(await counts(), { jobs: 1, receipts: 1, effects: 1 });
  assert.equal(
    (await fixture.source.query("SELECT status FROM platform.outbox")).rows[0].status,
    "succeeded",
  );
});

test("batch publication handles uncertain partial delivery without losing or repeating effects", async () => {
  const inputs = Array.from({ length: 5 }, () => job());
  for (const input of inputs) await insert(input);
  await fixture.runtime("jobs", async ({ client }) => {
    const claimed = await claimDue(client, 100, "financial");
    assert.equal(claimed.length, 5);
    let calls = 0;
    assert.equal(
      await publishClaims(client, claimed, async (channel, bodies) => {
        calls++;
        assert.equal(channel, "financial");
        assert.equal(bodies.length, 5);
        const first = inputs.find((item) => item.id === bodies[0].id);
        assert.equal(await receive(first), "succeeded");
        throw new Error("synthetic-uncertain-partial-publish");
      }),
      false,
    );
    assert.equal(calls, 1);
  });
  for (const input of inputs) assert(["succeeded", "terminal"].includes(await receive(input)));
  assert.deepEqual(await counts(), { jobs: 5, receipts: 5, effects: 5 });
});

test("crashed publisher and expired execution leases are reclaimed; stale fencing tokens cannot execute", async () => {
  const input = job();
  await insert(input);
  const first = await fixture.runtime("jobs", async ({ client }) => (await claimDue(client))[0]);
  await fixture.source.query(
    "UPDATE platform.outbox SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",
    [input.id],
  );
  const second = await fixture.runtime("jobs", async ({ client }) => (await claimDue(client))[0]);
  assert.notEqual(second.leaseToken, first.leaseToken);
  await fixture.runtime("jobs", async (context) => {
    assert.equal(await executeClaim(context, first, probeHandlers), "stale");
    const acquired = await acquireExecution(context.client, {
      schemaVersion: 1,
      id: input.id,
      channel: input.channel,
    });
    assert.equal(typeof acquired, "object");
    assert.equal(
      await acquireExecution(context.client, {
        schemaVersion: 1,
        id: input.id,
        channel: input.channel,
      }),
      "busy",
    );
    await fixture.source.query(
      "UPDATE platform.outbox SET lease_until=clock_timestamp()-interval '1 second', next_attempt_at=clock_timestamp() WHERE id=$1",
      [input.id],
    );
    assert.equal(await receive(input), "succeeded");
    assert.equal(await executeClaim(context, acquired, probeHandlers), "stale");
  });
  assert.deepEqual(await counts(), { jobs: 1, receipts: 1, effects: 1 });
});

test("transactional effect crash rolls back receipt/effect, then redelivery succeeds once", async () => {
  const input = job();
  await insert(input);
  await assert.rejects(
    receive(input, {
      "platform.probe": {
        decide: async () => "allow",
        apply: async (context, item) => {
          await probeHandlers["platform.probe"].apply(context, item);
          throw new Error("synthetic-effect-crash");
        },
      },
    }),
    /synthetic-effect-crash/,
  );
  assert.deepEqual(await counts(), { jobs: 1, receipts: 0, effects: 0 });
  await fixture.source.query(
    "UPDATE platform.outbox SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",
    [input.id],
  );
  assert.equal(await receive(input), "succeeded");
  assert.deepEqual(await counts(), { jobs: 1, receipts: 1, effects: 1 });
});

test("current consent/revision guards suppress jobs and missing domain handlers never acknowledge success", async () => {
  for (const decision of ["consent_revoked", "version_changed", "not_authorized"]) {
    const input = job();
    await insert(input);
    await fixture.source.query(
      "INSERT INTO platform.p1_authority_fixture(subject_id,revision,consent) VALUES($1,1,true)",
      [input.subjectId],
    );
    if (decision === "consent_revoked")
      await fixture.source.query(
        "UPDATE platform.p1_authority_fixture SET consent=false WHERE subject_id=$1",
        [input.subjectId],
      );
    if (decision === "version_changed")
      await fixture.source.query(
        "UPDATE platform.p1_authority_fixture SET revision=2 WHERE subject_id=$1",
        [input.subjectId],
      );
    if (decision === "not_authorized")
      await fixture.source.query("DELETE FROM platform.p1_authority_fixture WHERE subject_id=$1", [
        input.subjectId,
      ]);
    assert.equal(
      await receive(input, {
        "platform.probe": {
          decide: async ({ client }, current) => {
            const row = (
              await client.query(
                "SELECT revision,consent FROM platform.p1_authority_fixture WHERE subject_id=$1 FOR SHARE",
                [current.subjectId],
              )
            ).rows[0];
            if (!row) return "not_authorized";
            if (row.revision !== current.revision) return "version_changed";
            return row.consent ? "allow" : "consent_revoked";
          },
          apply: async () => assert.fail("Suppressed effect executed"),
        },
      }),
      "suppressed",
    );
  }
  const missing = job({ kind: "commerce.reconcile" });
  await insert(missing);
  await assert.rejects(receive(missing), /No reviewed domain handler/);
  assert.equal((await counts()).effects, 0);
  const expired = job({
    dueAt: new Date(Date.now() - 10000),
    deadlineAt: new Date(Date.now() - 1000),
  });
  await insert(expired);
  assert.equal(await receive(expired), "suppressed");
  const future = job({ dueAt: new Date(Date.now() + 10000) });
  await insert(future);
  assert.equal(await receive(future), "busy");
});

test("a guard finishing after the current deadline cannot execute its effect", async () => {
  const input = job({ deadlineAt: new Date(Date.now() + 4000) });
  await insert(input);
  let checked = false;
  const outcome = await receive(input, {
    "platform.probe": {
      decide: async ({ client }, current) => {
        checked = true;
        await client.query(
          "SELECT pg_sleep(greatest(0,extract(epoch FROM(deadline_at-clock_timestamp())))::float8+0.05) FROM platform.outbox WHERE id=$1",
          [current.id],
        );
        return "allow";
      },
      apply: async () => assert.fail("Expired effect executed"),
    },
  });
  assert(checked);
  assert.equal(outcome, "suppressed");
  assert.equal((await counts()).effects, 0);
});

test("failed publishing is durable and bounded; authoritative channel mismatch and forged completion are denied", async () => {
  const input = job();
  await insert(input);
  for (let attempt = 0; attempt < 5; attempt++) {
    await fixture.runtime("jobs", async ({ client }) => {
      const [claim] = await claimDue(client);
      assert(claim);
      assert.equal(
        await publishClaim(client, claim, async () => {
          throw new Error("synthetic-queue-outage");
        }),
        false,
      );
    });
    await fixture.source.query(
      "UPDATE platform.outbox SET next_attempt_at=clock_timestamp() WHERE id=$1",
      [input.id],
    );
  }
  await fixture.runtime("jobs", ({ client }) => claimDue(client));
  assert.equal(
    (await fixture.source.query("SELECT status,publish_attempts FROM platform.outbox")).rows[0]
      .status,
    "dead",
  );
  await assert.rejects(
    fixture.runtime("jobs", ({ client }) =>
      acquireExecution(client, { schemaVersion: 1, id: input.id, channel: "clinical" }),
    ),
    /reference does not match/,
  );
  await assert.rejects(
    fixture.runtime("core", ({ client }) =>
      client.query("UPDATE platform.outbox SET status='succeeded' WHERE id=$1", [input.id]),
    ),
    /permission denied/,
  );
  await assert.rejects(
    fixture.runtime("jobs", ({ client }) =>
      client.query("UPDATE platform.outbox SET subject_id=$1 WHERE id=$2", [
        randomUUID(),
        input.id,
      ]),
    ),
    /permission denied/,
  );
});

test("transaction-local scope is cleared on commit and rollback on the same real driver connection", async () => {
  const actor = randomUUID();
  const other = randomUUID();
  await fixture.source.query("TRUNCATE core.p1_scope_fixture");
  await fixture.source.query(
    "INSERT INTO core.p1_scope_fixture(id,actor_id) VALUES($1,$2),($3,$4)",
    [randomUUID(), actor, randomUUID(), other],
  );
  await fixture.runtime("core", async ({ client }) => {
    assert.equal((await client.query("SELECT * FROM core.p1_scope_fixture")).rowCount, 0);
    await transaction(client, async () => {
      await client.query("SELECT set_config('app.actor_id',$1,true)", [actor]);
      const visible = await client.query("SELECT actor_id FROM core.p1_scope_fixture");
      assert.deepEqual(
        visible.rows.map((row) => row.actor_id),
        [actor],
      );
      assert.equal(
        (await client.query("SELECT * FROM core.p1_scope_fixture WHERE actor_id=$1", [other]))
          .rowCount,
        0,
      );
    });
    assert.equal(
      (await client.query("SELECT nullif(current_setting('app.actor_id',true),'') AS actor"))
        .rows[0].actor,
      null,
    );
    await assert.rejects(
      transaction(client, async () => {
        await client.query("SELECT set_config('app.actor_id',$1,true)", [randomUUID()]);
        assert.equal((await client.query("SELECT * FROM core.p1_scope_fixture")).rowCount, 0);
        throw new Error("rollback");
      }),
    );
    assert.equal(
      (await client.query("SELECT nullif(current_setting('app.actor_id',true),'') AS actor"))
        .rows[0].actor,
      null,
    );
    assert.equal((await client.query("SELECT * FROM core.p1_scope_fixture")).rowCount, 0);
  });
});

test("deployment lock serializes a target and schema compatibility rejects an incompatible rollback", async () => {
  const artifact = {
    apiVersion: 1,
    namespace: "kandamkulathi-local",
    environment: "local",
    migrations: migrationFiles().map(({ id, sha256 }) => ({ id, sha256 })),
  };
  await withDeploymentLock(fixture.sourceUrl, async (client) => {
    assert.equal((await checkCompatibility(client, artifact)).compatible, true);
    await assert.rejects(
      withDeploymentLock(fixture.sourceUrl, async () =>
        assert.fail("Overlapping deployment entered"),
      ),
      /holds this target/,
    );
  });
  await withDeploymentLock(fixture.sourceUrl, async () => {});
  await assert.rejects(
    withDeploymentLock(fixture.sourceUrl, (client) =>
      checkCompatibility(client, { ...artifact, apiVersion: 2 }),
    ),
    /rejects this API/,
  );
});

test("migrations are repeatable and reject tampered applied checksums", async () => {
  assert.equal(
    (await migrate(fixture.sourceUrl, { environment: "local", namespace: "kandamkulathi-local" }))
      .length,
    2,
  );
  const original = (
    await fixture.source.query(
      "SELECT id,sha256 FROM public.k_platform_migrations ORDER BY id LIMIT 1",
    )
  ).rows[0];
  await fixture.source.query(
    "UPDATE public.k_platform_migrations SET sha256='tampered' WHERE id=$1",
    [original.id],
  );
  try {
    await assert.rejects(
      migrate(fixture.sourceUrl, { environment: "local", namespace: "kandamkulathi-local" }),
      /checksum changed/,
    );
  } finally {
    await fixture.source.query("UPDATE public.k_platform_migrations SET sha256=$2 WHERE id=$1", [
      original.id,
      original.sha256,
    ]);
  }
  assert.throws(() =>
    operationTarget(fixture.sourceUrl.replace("127.0.0.1", "remote.invalid"), "local"),
  );
});

test("local seed/reset handles only synthetic probes and preserves domain obligations", async () => {
  const domain = job({ kind: "commerce.reconcile" });
  await insert(domain);
  const seeded = await syntheticFixtures(fixture.sourceUrl, "seed", "kandamkulathi-local");
  assert.equal(await receive({ ...seeded, channel: "financial" }), "succeeded");
  assert.equal(
    (await syntheticFixtures(fixture.sourceUrl, "reset-probes", "kandamkulathi-local")).deleted,
    1,
  );
  assert.deepEqual((await fixture.source.query("SELECT id,kind FROM platform.outbox")).rows, [
    { id: domain.id, kind: "commerce.reconcile" },
  ]);
  await assert.rejects(
    syntheticFixtures(fixture.sourceUrl, "reset-probes", "kandamkulathi-production"),
  );
});

test("real pg_dump export is encrypted and restores data, grants, RLS and receipts into a separate database", {
  timeout: 60000,
}, async () => {
  const input = job();
  await insert(input);
  assert.equal(await receive(input), "succeeded");
  const directory = resolve(".local-data", `platform-recovery-${randomBytes(5).toString("hex")}`);
  mkdirSync(directory, { recursive: true });
  const output = resolve(directory, "synthetic.kav");
  const key = randomBytes(32).toString("base64");
  const objectBytes = Buffer.from("synthetic-private-object");
  const sha256 = digest(objectBytes);
  const objects = [
    {
      bucket: "kandamkulathi-local-private",
      key: `sha256/${sha256}`,
      sha256,
      size: objectBytes.length,
    },
  ];
  const inventory = await exportEncrypted({
    connectionString: fixture.urls.backup,
    environment: "local",
    namespace: "kandamkulathi-local",
    output,
    key,
    keyId: "synthetic-test-key",
    objects,
  });
  assert.equal(inventory.controlTotals.effects, 1);
  assert.equal(readFileSync(output).includes(Buffer.from(input.operationId)), false);
  const restoredUrl = await fixture.makeDatabase();
  const common = {
    connectionString: restoredUrl,
    environment: "local",
    namespace: "kandamkulathi-local",
    input: output,
    key,
  };
  await assert.rejects(restoreEncrypted({ ...common, key: randomBytes(32).toString("base64") }));
  const badManifest = { ...inventory, objects: [] };
  writeFileSync(`${output}.manifest.json`, JSON.stringify(badManifest));
  await assert.rejects(restoreEncrypted(common), /inventory was modified/);
  writeFileSync(`${output}.manifest.json`, JSON.stringify(inventory));
  const encrypted = readFileSync(output);
  const corrupted = Buffer.from(encrypted);
  corrupted[corrupted.length - 1] ^= 1;
  writeFileSync(output, corrupted);
  writeFileSync(
    `${output}.manifest.json`,
    JSON.stringify({ ...inventory, sha256: digest(corrupted) }),
  );
  await assert.rejects(restoreEncrypted(common));
  assert.equal(
    await withAdmin(
      restoredUrl,
      async (client) =>
        (
          await client.query(
            "SELECT count(*)::integer AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='platform'",
          )
        ).rows[0].count,
    ),
    0,
  );
  writeFileSync(output, encrypted);
  writeFileSync(`${output}.manifest.json`, JSON.stringify(inventory));
  const restored = await restoreEncrypted(common);
  assert.deepEqual(restored.controlTotals, inventory.controlTotals);
  assert.deepEqual(restored.objects, objects);
  const runtimeUrl = new URL(fixture.urls.jobs);
  runtimeUrl.pathname = new URL(restoredUrl).pathname;
  await withDatabase(
    runtimeUrl.href,
    "local",
    "k_jobs_runtime",
    async (context) => {
      assert.equal(
        await acquireExecution(context.client, {
          schemaVersion: 1,
          id: input.id,
          channel: input.channel,
        }),
        "terminal",
      );
      assert.equal(
        (
          await context.client.query(
            "SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='platform.outbox'::regclass",
          )
        ).rows[0].relforcerowsecurity,
        true,
      );
    },
    fixture.localProxy,
  );
  await assert.rejects(restoreEncrypted(common), /new empty isolated/);
  assert.equal(
    readdirSync(directory).some((name) => name.endsWith(".dump")),
    false,
  );
});
