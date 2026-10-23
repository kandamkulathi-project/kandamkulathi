import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  releaseExecution,
} from "../../packages/database/src/outbox.ts";
import { exportEncrypted, restoreEncrypted } from "../../scripts/platform/backup.mjs";
import { testDatabase } from "./support.mjs";

let fixture;
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
const envelope = (input) => ({ schemaVersion: 1, id: input.id, channel: input.channel });
const insert = (input) =>
  fixture.runtime("core", (context) => transaction(context.client, () => enqueue(context, input)));
const expireBackoff = (input) =>
  fixture.source.query(
    "UPDATE platform.outbox SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [input.id],
  );
const row = async (input) =>
  (
    await fixture.source.query(
      `SELECT status,publish_attempts,execution_attempts,failure_code,
    next_attempt_at > clock_timestamp() AS backing_off FROM platform.outbox WHERE id=$1`,
      [input.id],
    )
  ).rows[0];
async function finalPublication(input) {
  await insert(input);
  await fixture.runtime("jobs", async ({ client }) => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const [claim] = await claimDue(client, 20, input.channel);
      assert(claim);
      assert.equal(
        await publishClaim(client, claim, async () => {
          if (attempt < 5) throw new Error("synthetic-publish-failure");
        }),
        attempt === 5,
      );
      if (attempt < 5) await expireBackoff(input);
    }
  });
}
async function failExecution(input) {
  await fixture.runtime("jobs", async (context) => {
    const acquired = await acquireExecution(context.client, envelope(input));
    assert.notEqual(typeof acquired, "string");
    await assert.rejects(
      executeClaim(context, acquired, {
        "platform.probe": {
          decide: async () => "allow",
          apply: async (ctx, claimed) => {
            await probeHandlers["platform.probe"].apply(ctx, claimed);
            throw new Error("synthetic-transient-handler-failure");
          },
        },
      }),
      /synthetic-transient-handler-failure/,
    );
    await releaseExecution(context.client, acquired);
  });
}

test("REVIEW-004 fifth publication survives execution failure, sweeps and delayed redelivery exactly once", async () => {
  const input = job();
  await finalPublication(input);
  await failExecution(input);
  assert.deepEqual(await row(input), {
    status: "pending",
    publish_attempts: 5,
    execution_attempts: 1,
    failure_code: "execution_failed",
    backing_off: true,
  });
  await fixture.runtime("jobs", async ({ client }) => {
    assert.deepEqual(await claimDue(client, 20, "clinical"), []);
    assert.equal(
      (await row(input)).status,
      "pending",
      "Publication sweep discarded an execution retry",
    );
    assert.equal(await acquireExecution(client, envelope(input)), "busy");
    await expireBackoff(input);
    assert.deepEqual(await claimDue(client, 20, "clinical"), []);
    const acquired = await acquireExecution(client, envelope(input));
    assert.notEqual(typeof acquired, "string");
    assert.equal(await executeClaim({ client }, acquired, probeHandlers), "succeeded");
    assert.equal(await acquireExecution(client, envelope(input)), "terminal");
  });
  assert.equal((await row(input)).execution_attempts, 2);
  assert.deepEqual(
    (
      await fixture.source.query(`SELECT
    (SELECT count(*)::int FROM platform.probe_effects) AS effects,
    (SELECT count(*)::int FROM platform.receipts) AS receipts`)
    ).rows[0],
    { effects: 1, receipts: 1 },
  );
});

test("REVIEW-005 immediate duplicate deliveries respect execution backoff without spending attempts", async () => {
  const input = job();
  await finalPublication(input);
  await failExecution(input);
  const results = [];
  for (let i = 0; i < 8; i++) {
    results.push(
      await fixture.runtime("jobs", async ({ client }) => {
        const acquired = await acquireExecution(client, envelope(input));
        // Exercise the consumer's outage path if an immediate duplicate was wrongly admitted.
        if (typeof acquired !== "string") await releaseExecution(client, acquired);
        return typeof acquired === "string" ? acquired : "admitted";
      }),
    );
  }
  assert.deepEqual(results, Array(8).fill("busy"));
  assert.equal((await row(input)).execution_attempts, 1);
  await expireBackoff(input);
  await fixture.runtime("jobs", async (context) => {
    const acquired = await acquireExecution(context.client, envelope(input));
    assert.notEqual(typeof acquired, "string");
    assert.equal(await executeClaim(context, acquired, probeHandlers), "succeeded");
  });
});

test("REVIEW-004 execution retries remain bounded by their own budget and the business deadline", async () => {
  const exhausted = job();
  await finalPublication(exhausted);
  for (let attempt = 1; attempt <= 5; attempt++) {
    if (attempt > 1) await expireBackoff(exhausted);
    await failExecution(exhausted);
    await fixture.runtime("jobs", ({ client }) => claimDue(client, 20, "clinical"));
    assert.equal((await row(exhausted)).status, attempt === 5 ? "dead" : "pending");
  }
  assert.equal((await row(exhausted)).failure_code, "retry_exhausted");
  assert.equal((await row(exhausted)).execution_attempts, 5);
  const expired = job();
  await finalPublication(expired);
  await failExecution(expired);
  await fixture.source.query(
    "UPDATE platform.outbox SET deadline_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [expired.id],
  );
  await fixture.runtime("jobs", ({ client }) => claimDue(client, 20, "clinical"));
  assert.equal((await row(expired)).status, "suppressed");
  assert.equal((await row(expired)).failure_code, "deadline_elapsed");
});

for (const fast of [false, true]) {
  test(`REVIEW-005 republished delivery after an earlier execution failure can execute ${fast ? "before" : "after"} publisher checkpoint`, async () => {
    const input = job();
    await insert(input);
    await fixture.runtime("jobs", async ({ client }) => {
      const [claim] = await claimDue(client);
      await publishClaim(client, claim, async () => {});
    });
    await failExecution(input);
    await expireBackoff(input);
    await fixture.runtime("jobs", async (context) => {
      const [claim] = await claimDue(context.client);
      const consume = async () => {
        const acquired = await acquireExecution(context.client, envelope(input));
        assert.notEqual(typeof acquired, "string");
        assert.equal(await executeClaim(context, acquired, probeHandlers), "succeeded");
      };
      assert.equal(
        await publishClaim(context.client, claim, async () => {
          if (fast) await consume();
        }),
        true,
      );
      if (!fast) await consume();
      assert.equal(await acquireExecution(context.client, envelope(input)), "terminal");
    });
    assert.equal((await row(input)).status, "succeeded");
    assert.equal((await row(input)).execution_attempts, 2);
    assert.equal((await row(input)).publish_attempts, 2);
  });
}

test("REVIEW-006 caught SQL failure rejects a rollback command tag instead of reporting callback success", async () => {
  const input = job();
  await fixture.runtime("core", async (context) => {
    await assert.rejects(
      transaction(context.client, async () => {
        await enqueue(context, input);
        await assert.rejects(context.client.query("SELECT 1/0"), /division by zero/);
        return "claimed-success";
      }),
      /did not commit/,
    );
    assert.equal(inTransaction(context.client), false);
    assert.equal(
      (await fixture.source.query("SELECT count(*)::int AS count FROM platform.outbox")).rows[0]
        .count,
      0,
    );
    assert.equal(await transaction(context.client, async () => 42), 42);
  });
});

const backupOptions = () => {
  const directory = resolve(".local-data", `review-round-two-${randomBytes(6).toString("hex")}`);
  mkdirSync(directory, { recursive: true });
  return {
    connectionString: fixture.urls.backup,
    environment: "local",
    namespace: "kandamkulathi-local",
    output: resolve(directory, "synthetic.kav"),
    key: randomBytes(32).toString("base64"),
    keyId: "synthetic-review-key",
  };
};
const outcome = (promise) =>
  promise.then(
    (value) => ({ status: "fulfilled", value }),
    (reason) => ({ status: "rejected", reason }),
  );
async function waitForBlockedExport() {
  const database = new URL(fixture.sourceUrl).pathname.slice(1);
  const user = new URL(fixture.urls.backup).username;
  for (let attempt = 0; attempt < 200; attempt++) {
    const result = await fixture.admin.query(
      `SELECT 1 FROM pg_stat_activity
      WHERE datname=$1 AND usename=$2 AND wait_event_type='Lock'`,
      [database, user],
    );
    if (result.rows.length) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail("Restricted export did not reach the controlled real-database lock");
}
async function holdExport() {
  await fixture.source.query("BEGIN");
  await fixture.source.query("LOCK TABLE platform.probe_effects IN ACCESS EXCLUSIVE MODE");
}

test("REVIEW-007 same-destination exports reserve before awaits and losing callers cannot remove the owner's partial", {
  timeout: 60000,
}, async () => {
  const options = backupOptions();
  await holdExport();
  const first = outcome(exportEncrypted(options));
  let second;
  try {
    await waitForBlockedExport();
    second = outcome(exportEncrypted(options));
    let timer;
    const loser = await Promise.race([
      second,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve({ status: "still-running" }), 1000);
      }),
    ]);
    clearTimeout(timer);
    assert.equal(
      loser.status,
      "rejected",
      "Concurrent exporter entered asynchronous database work",
    );
    assert.equal(
      existsSync(`${options.output}.partial`),
      true,
      "Losing exporter removed the owner's reservation",
    );
  } finally {
    await fixture.source.query("ROLLBACK");
    await Promise.all([first, second]);
  }
  const completed = await first;
  if (completed.status === "rejected") throw completed.reason;
  assert.equal(completed.status, "fulfilled");
  assert.equal(existsSync(`${options.output}.partial`), false);
  const artifact = readFileSync(options.output);
  const inventory = readFileSync(`${options.output}.manifest.json`);
  await assert.rejects(exportEncrypted(options), /existing|overwrite/i);
  assert.deepEqual(readFileSync(options.output), artifact);
  assert.deepEqual(readFileSync(`${options.output}.manifest.json`), inventory);
  const target = await fixture.makeDatabase();
  assert.equal(
    (
      await restoreEncrypted({
        connectionString: target,
        environment: "local",
        namespace: options.namespace,
        input: options.output,
        key: options.key,
      })
    ).status,
    "restored",
  );
});

test("REVIEW-007 publication never replaces an output that appears while an export is running", {
  timeout: 60000,
}, async () => {
  const options = backupOptions();
  await holdExport();
  const pending = outcome(exportEncrypted(options));
  const sentinel = Buffer.from("existing-artifact-must-not-be-replaced");
  try {
    await waitForBlockedExport();
    writeFileSync(options.output, sentinel, { flag: "wx", mode: 0o600 });
  } finally {
    await fixture.source.query("ROLLBACK");
  }
  const completed = await pending;
  assert.equal(completed.status, "rejected");
  assert.equal(
    completed.reason.code,
    "EEXIST",
    "Export failed before exercising no-replace publication",
  );
  assert.deepEqual(readFileSync(options.output), sentinel);
  assert.equal(existsSync(`${options.output}.partial`), false);
  assert.equal(
    existsSync(`${options.output}.manifest.json`),
    false,
    "Failed publisher left a mismatched manifest",
  );
});

test("REVIEW-007 existing partials/manifests are preserved and failed owners clean only their own reservation", async () => {
  for (const suffix of [".partial", ".manifest.json"]) {
    const options = backupOptions();
    const sentinel = Buffer.from("unowned-investigation-evidence");
    writeFileSync(`${options.output}${suffix}`, sentinel, { flag: "wx", mode: 0o600 });
    await assert.rejects(exportEncrypted(options));
    assert.deepEqual(readFileSync(`${options.output}${suffix}`), sentinel);
    assert.equal(existsSync(options.output), false);
    if (suffix !== ".partial") assert.equal(existsSync(`${options.output}.partial`), false);
  }
  const options = backupOptions();
  await assert.rejects(
    exportEncrypted({ ...options, connectionString: fixture.urls.core }),
    /backup login/,
  );
  assert.equal(existsSync(`${options.output}.partial`), false);
  assert.equal(existsSync(options.output), false);
});
