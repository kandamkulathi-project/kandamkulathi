import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { inTransaction, transaction } from "../../packages/database/src/client.ts";
import {
  acquireExecution,
  claimDue,
  enqueue,
  executeClaim,
  probeHandlers,
  publishClaim,
} from "../../packages/database/src/outbox.ts";
import { exportEncrypted, restoreEncrypted } from "../../scripts/platform/backup.mjs";
import { digest, migrationFiles, withAdmin } from "../../scripts/platform/database.mjs";
import { testDatabase } from "./support.mjs";

let fixture;
const job = () => ({
  id: randomUUID(),
  operationId: randomUUID(),
  channel: "financial",
  kind: "platform.probe",
  subjectId: randomUUID(),
  revision: 1,
  dueAt: new Date(Date.now() - 10000),
  deadlineAt: new Date(Date.now() + 3600000),
});
const insert = (input) =>
  fixture.runtime("core", (context) => transaction(context.client, () => enqueue(context, input)));
const receive = (input) =>
  fixture.runtime("jobs", async (context) => {
    const acquired = await acquireExecution(context.client, {
      schemaVersion: 1,
      id: input.id,
      channel: input.channel,
    });
    return typeof acquired === "string" ? acquired : executeClaim(context, acquired, probeHandlers);
  });
const ledger = () =>
  fixture.source
    .query("SELECT id,sha256 FROM public.k_platform_migrations ORDER BY id")
    .then(({ rows }) => rows);
const exportBackup = async () => {
  const directory = resolve(".local-data", `review-recovery-${randomBytes(6).toString("hex")}`);
  mkdirSync(directory, { recursive: true });
  const output = resolve(directory, "synthetic.kav");
  const key = randomBytes(32).toString("base64");
  const inventory = await exportEncrypted({
    connectionString: fixture.urls.backup,
    environment: "local",
    namespace: "kandamkulathi-local",
    output,
    key,
    keyId: "synthetic-review-key",
  });
  return { directory, output, key, inventory };
};
const restoreBackup = async ({ output, key }) => {
  const connectionString = await fixture.makeDatabase();
  const run = () =>
    restoreEncrypted({
      connectionString,
      environment: "local",
      namespace: "kandamkulathi-local",
      input: output,
      key,
    });
  return { connectionString, run };
};

// Synthetic key holder constructs the old export bug: valid authentication, but a declaration
// that disagrees with the actual pg_dump ledger. No production escape hatch or mock restore.
function redeclareMigrations({ output, key }, migrations) {
  const encrypted = readFileSync(output);
  const size = encrypted.readUInt32BE(8);
  const headerLength = 12 + size + 12;
  const metadata = JSON.parse(encrypted.subarray(12, 12 + size).toString("utf8"));
  const secret = Buffer.from(key, "base64");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    secret,
    encrypted.subarray(12 + size, headerLength),
  );
  decipher.setAAD(encrypted.subarray(0, headerLength));
  decipher.setAuthTag(encrypted.subarray(-16));
  const dump = Buffer.concat([
    decipher.update(encrypted.subarray(headerLength, -16)),
    decipher.final(),
  ]);
  metadata.migrations = migrations;
  const bytes = Buffer.from(JSON.stringify(metadata));
  const prefix = Buffer.from(encrypted.subarray(0, 12));
  prefix.writeUInt32BE(bytes.length, 8);
  const iv = randomBytes(12);
  const header = Buffer.concat([prefix, bytes, iv]);
  const cipher = createCipheriv("aes-256-gcm", secret, iv);
  cipher.setAAD(header);
  const artifact = Buffer.concat([
    header,
    cipher.update(dump),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  writeFileSync(output, artifact, { mode: 0o600 });
  writeFileSync(
    `${output}.manifest.json`,
    JSON.stringify({
      ...metadata,
      sha256: digest(artifact),
      bytes: artifact.length,
    }),
    { mode: 0o600 },
  );
}

before(
  async () => {
    fixture = await testDatabase();
  },
  { timeout: 30000 },
);
beforeEach(async () => {
  await fixture.reset();
});
after(async () => {
  await fixture?.close();
});

test("REVIEW-001 concurrent transactions on one real connection cannot commit a rejected caller's write", async () => {
  const committed = job();
  const rejected = job();
  await fixture.runtime("core", async (context) => {
    const secondReached = Promise.withResolvers();
    let secondEntered = false;
    const first = transaction(context.client, async () => {
      await enqueue(context, committed);
      await secondReached.promise;
    });
    const second = transaction(context.client, async () => {
      secondEntered = true;
      await enqueue(context, rejected);
      secondReached.resolve();
      await first;
      throw new Error("synthetic-rejected-operation");
    });
    second.catch(() => secondReached.resolve());
    const outcomes = await Promise.allSettled([first, second]);
    assert.equal(outcomes[0].status, "fulfilled");
    assert.equal(outcomes[1].status, "rejected");
    assert.deepEqual(
      (await fixture.source.query("SELECT id FROM platform.outbox")).rows,
      [{ id: committed.id }],
      "A rejected caller retained a committed outbox write",
    );
    assert.equal(secondEntered, false, "Overlapping callback entered the reserved transaction");
    assert.equal(inTransaction(context.client), false);
    await transaction(context.client, async () => {
      await assert.rejects(
        transaction(context.client, async () => assert.fail("Nested callback ran")),
        /Overlapping|Nested/,
      );
    });
  });
});

test("REVIEW-001 failed BEGIN releases the real connection reservation for later transactions", async () => {
  await fixture.runtime("core", async ({ client }) => {
    await client.query("BEGIN");
    await assert.rejects(client.query("SELECT 1/0"), /division by zero/);
    await assert.rejects(
      transaction(client, async () => assert.fail("Failed BEGIN entered callback")),
      /current transaction is aborted/,
    );
    assert.equal(inTransaction(client), false);
    await client.query("ROLLBACK");
    assert.equal(
      await transaction(
        client,
        async () => (await client.query("SELECT 42 AS value")).rows[0].value,
      ),
      42,
    );
  });
});

test("REVIEW-002 successful fifth publication survives another channel sweep and executes exactly once", async () => {
  const input = job();
  await insert(input);
  await fixture.runtime("jobs", async ({ client }) => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const [claim] = await claimDue(client, 20, "financial");
      assert(claim);
      const published = await publishClaim(client, claim, async () => {
        if (attempt < 5) throw new Error("synthetic-publication-failure");
      });
      assert.equal(published, attempt === 5);
      if (!published)
        await fixture.source.query(
          "UPDATE platform.outbox SET next_attempt_at=clock_timestamp() WHERE id=$1",
          [input.id],
        );
    }
    assert.deepEqual(
      (
        await fixture.source.query(
          `SELECT status,publish_attempts,execution_attempts,
      next_attempt_at > clock_timestamp() AS awaiting_delivery FROM platform.outbox WHERE id=$1`,
          [input.id],
        )
      ).rows[0],
      { status: "queued", publish_attempts: 5, execution_attempts: 0, awaiting_delivery: true },
    );
    assert.deepEqual(await claimDue(client, 20, "clinical"), []);
    assert.equal(
      (await fixture.source.query("SELECT status FROM platform.outbox WHERE id=$1", [input.id]))
        .rows[0].status,
      "queued",
    );
  });
  assert.equal(await receive(input), "succeeded");
  assert.equal(await receive(input), "terminal");
  assert.deepEqual(
    (
      await fixture.source.query(`SELECT
    (SELECT count(*)::int FROM platform.receipts) AS receipts,
    (SELECT count(*)::int FROM platform.probe_effects) AS effects`)
    ).rows[0],
    { receipts: 1, effects: 1 },
  );
});

test("REVIEW-002 final publication still expires after its recovery window or business deadline", async () => {
  const inputs = [job(), job()];
  for (const input of inputs) await insert(input);
  await fixture.source.query("UPDATE platform.outbox SET publish_attempts=4");
  await fixture.runtime("jobs", async ({ client }) => {
    for (const claim of await claimDue(client)) await publishClaim(client, claim, async () => {});
    await fixture.source.query(
      "UPDATE platform.outbox SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      [inputs[0].id],
    );
    await fixture.source.query(
      "UPDATE platform.outbox SET deadline_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      [inputs[1].id],
    );
    assert.deepEqual(await claimDue(client, 20, "clinical"), []);
  });
  for (const [index, expected] of [
    [0, { status: "dead", failure_code: "retry_exhausted", publish_attempts: 5 }],
    [1, { status: "suppressed", failure_code: "deadline_elapsed", publish_attempts: 5 }],
  ])
    assert.deepEqual(
      (
        await fixture.source.query(
          "SELECT status,failure_code,publish_attempts FROM platform.outbox WHERE id=$1",
          [inputs[index].id],
        )
      ).rows[0],
      expected,
    );
});

for (const variant of ["newer-schema", "changed-checksum"]) {
  test(`REVIEW-003 export binds actual ${variant} ledger and incompatible restore is refused before SQL`, {
    timeout: 60000,
  }, async () => {
    const original = await ledger();
    const extra = { id: "0002_review_newer_schema", sha256: digest("synthetic newer migration") };
    try {
      if (variant === "newer-schema")
        await fixture.source.query(
          "INSERT INTO public.k_platform_migrations(id,sha256) VALUES($1,$2)",
          [extra.id, extra.sha256],
        );
      else
        await fixture.source.query(
          "UPDATE public.k_platform_migrations SET sha256=$2 WHERE id=$1",
          [original[0].id, digest("synthetic changed migration")],
        );
      const actual = await ledger();
      const backup = await exportBackup();
      assert.deepEqual(
        backup.inventory.migrations,
        actual,
        "Export declared checkout migrations instead of its snapshot ledger",
      );
      const restored = await restoreBackup(backup);
      await assert.rejects(restored.run(), /cannot validate this schema/);
      await withAdmin(restored.connectionString, async (client) => {
        assert.equal(
          (await client.query("SELECT to_regclass('public.k_platform_migrations') AS ledger"))
            .rows[0].ledger,
          null,
        );
      });
    } finally {
      await fixture.source.query("DELETE FROM public.k_platform_migrations WHERE id=$1", [
        extra.id,
      ]);
      await fixture.source.query("UPDATE public.k_platform_migrations SET sha256=$2 WHERE id=$1", [
        original[0].id,
        original[0].sha256,
      ]);
    }
  });

  test(`REVIEW-003 restored ${variant} ledger must match authenticated declaration even when control totals match`, {
    timeout: 60000,
  }, async () => {
    const original = await ledger();
    const extra = { id: "0002_review_newer_schema", sha256: digest("synthetic newer migration") };
    try {
      if (variant === "newer-schema")
        await fixture.source.query(
          "INSERT INTO public.k_platform_migrations(id,sha256) VALUES($1,$2)",
          [extra.id, extra.sha256],
        );
      else
        await fixture.source.query(
          "UPDATE public.k_platform_migrations SET sha256=$2 WHERE id=$1",
          [original[0].id, digest("synthetic changed migration")],
        );
      const backup = await exportBackup();
      redeclareMigrations(
        backup,
        migrationFiles().map(({ id, sha256 }) => ({ id, sha256 })),
      );
      const restored = await restoreBackup(backup);
      await assert.rejects(restored.run(), /Restored migration set differs/);
      // The restore must report failure, with its target quarantined. Matching counts alone cannot pass.
      await withAdmin(restored.connectionString, async (client) => {
        assert.equal(
          (await client.query("SELECT count(*)::int AS count FROM public.k_platform_migrations"))
            .rows[0].count,
          backup.inventory.controlTotals.migrations,
        );
      });
      assert.equal(
        readdirSync(backup.directory).some((name) => name.endsWith(".dump")),
        false,
      );
    } finally {
      await fixture.source.query("DELETE FROM public.k_platform_migrations WHERE id=$1", [
        extra.id,
      ]);
      await fixture.source.query("UPDATE public.k_platform_migrations SET sha256=$2 WHERE id=$1", [
        original[0].id,
        original[0].sha256,
      ]);
    }
  });
}
