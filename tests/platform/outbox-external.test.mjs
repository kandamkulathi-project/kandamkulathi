import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { after, before, beforeEach, test } from "node:test";
import { inTransaction, transaction } from "../../packages/database/src/client.ts";
import {
  acquireExecution,
  claimDue,
  enqueue,
  executeClaim,
  releaseExecution,
} from "../../packages/database/src/outbox.ts";
import { executeExternalClaim } from "../../packages/database/src/outbox-external.ts";
import { testDatabase } from "./support.mjs";

// Real PostgreSQL transport/fencing proof with a loopback synthetic provider,
// NOT a knowledge approval, payment reconciliation or provider sandbox proof.
let fixture;
before(
  async () => {
    fixture = await testDatabase();
    // The authoritative journal must apply the review disposition before any job runs.
    const constraint = await fixture.source.query(
      "SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='platform.outbox'::regclass AND conname='outbox_failure'",
    );
    assert.match(constraint.rows[0]?.definition ?? "", /financial_review_required/);
    await fixture.source.query(
      "CREATE TABLE core.outbox_review_obligation(operation_id uuid PRIMARY KEY, outcome text NOT NULL)",
    );
  },
  { timeout: 30000 },
);
beforeEach(async () => {
  await fixture.reset();
});
after(async () => {
  await fixture?.close();
});

async function seed(overrides = {}) {
  const input = {
    id: randomUUID(),
    operationId: randomUUID(),
    subjectId: randomUUID(),
    channel: "financial",
    kind: "commerce.reconcile",
    revision: 1,
    dueAt: new Date(Date.now() - 1000),
    deadlineAt: new Date(Date.now() + 60000),
    ...overrides,
  };
  await fixture.runtime("core", (context) =>
    transaction(context.client, () => enqueue(context, input)),
  );
  return input;
}
const acquire = (context, input) =>
  acquireExecution(context.client, {
    schemaVersion: 1,
    id: input.id,
    channel: input.channel,
  });
const state = async () =>
  (
    await fixture.source.query(`SELECT
  (SELECT count(*)::int FROM platform.receipts) AS receipts,
  (SELECT count(*)::int FROM platform.probe_effects) AS effects,
  (SELECT status FROM platform.outbox LIMIT 1) AS status`)
  ).rows[0];

test("loopback effect runs after COMMIT, competing non-owner row lock proceeds, durable checkpoint and replay", async () => {
  const input = await seed();
  let calls = 0;
  let serverError;
  const server = createServer(async (_request, response) => {
    calls++;
    try {
      await fixture.runtime("jobs", ({ client }) =>
        transaction(client, async () => {
          const locked = await client.query(
            "SELECT status FROM platform.outbox WHERE id=$1 FOR UPDATE NOWAIT",
            [input.id],
          );
          assert.equal(locked.rows[0].status, "processing");
        }),
      );
      response.end("synthetic reconciled result");
    } catch (error) {
      serverError = error;
      response.statusCode = 500;
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await fixture.runtime("jobs", async (context) => {
      const job = await acquire(context, input);
      assert.equal(typeof job, "object");
      assert.equal(
        await executeExternalClaim(context, job, async (ctx, claimed, signal) => {
          assert.equal(inTransaction(ctx.client), false);
          const response = await fetch(`http://127.0.0.1:${server.address().port}`, { signal });
          assert.equal(response.status, 200);
          await response.text();
          signal.throwIfAborted();
          await transaction(ctx.client, () =>
            ctx.client.query(
              "INSERT INTO platform.probe_effects(operation_id) VALUES ($1) ON CONFLICT DO NOTHING",
              [claimed.operationId],
            ),
          );
        }),
        "succeeded",
      );
      assert.equal(await acquire(context, input), "terminal");
      assert.equal(
        await executeExternalClaim(context, job, async () => assert.fail("stale replay effect")),
        "stale",
      );
    });
    assert.ifError(serverError);
    assert.equal(calls, 1);
    assert.deepEqual(await state(), { receipts: 1, effects: 1, status: "succeeded" });
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("existing authoritative receipt completes without invoking provider", async () => {
  const input = await seed();
  await fixture.source.query(
    "INSERT INTO platform.receipts(operation_id,kind,job_id) VALUES ($1,$2,$3)",
    [input.operationId, input.kind, input.id],
  );
  await fixture.runtime("jobs", async (context) => {
    const job = await acquire(context, input);
    assert.equal(
      await executeExternalClaim(context, job, async () => assert.fail("receipt replay effect")),
      "succeeded",
    );
  });
  assert.deepEqual(await state(), { receipts: 1, effects: 0, status: "succeeded" });
});

test("immutable mismatches, revoked lease, expired lease and deadline prevent effects", async () => {
  const input = await seed();
  await fixture.runtime("jobs", async (context) => {
    const job = await acquire(context, input);
    for (const changed of [
      { id: randomUUID() },
      { operationId: randomUUID() },
      { subjectId: randomUUID() },
      { channel: "clinical" },
      { kind: "platform.probe" },
      { revision: 2 },
      { dueAt: new Date(job.dueAt.getTime() - 1) },
      { deadlineAt: new Date(job.deadlineAt.getTime() + 1) },
      { leaseToken: randomUUID() },
    ])
      assert.equal(
        await executeExternalClaim(context, { ...job, ...changed }, async () =>
          assert.fail("invalid claim effect"),
        ),
        "stale",
      );
    await fixture.source.query("UPDATE platform.outbox SET status='pending' WHERE id=$1", [job.id]);
    assert.equal(
      await executeExternalClaim(context, job, async () => assert.fail("non-processing effect")),
      "stale",
    );
    await fixture.source.query("UPDATE platform.outbox SET status='processing' WHERE id=$1", [
      job.id,
    ]);
    await fixture.source.query(
      "UPDATE platform.outbox SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",
      [job.id],
    );
    assert.equal(
      await executeExternalClaim(context, job, async () => assert.fail("expired lease effect")),
      "stale",
    );
    await fixture.source.query(
      "UPDATE platform.outbox SET deadline_at=$2, lease_until=clock_timestamp()+interval '30 seconds' WHERE id=$1",
      [job.id, new Date(Date.now() - 100)],
    );
    const expired = {
      ...job,
      deadlineAt: (
        await fixture.source.query("SELECT deadline_at FROM platform.outbox WHERE id=$1", [job.id])
      ).rows[0].deadline_at,
    };
    assert.equal(
      await executeExternalClaim(context, expired, async () =>
        assert.fail("expired deadline effect"),
      ),
      "dead",
    );
  });
  assert.deepEqual(await state(), { receipts: 0, effects: 0, status: "dead" });
});

test("nested transaction and unauthorized core role are rejected without effects", async () => {
  const input = await seed();
  let job;
  await fixture.runtime("jobs", async (context) => {
    job = await acquire(context, input);
    await transaction(context.client, async () => {
      await assert.rejects(
        executeExternalClaim(context, job, async () => assert.fail("nested effect")),
        /inside a platform transaction/,
      );
    });
  });
  await assert.rejects(
    fixture.runtime("core", (context) =>
      executeExternalClaim(context, job, async () => assert.fail("unauthorized effect")),
    ),
    /permission denied/,
  );
  assert.deepEqual(await state(), { receipts: 0, effects: 0, status: "processing" });
});

test("domain denial and uncertain callback failure leave no platform receipt; release and retry reconcile", async () => {
  const input = await seed();
  await fixture.runtime("jobs", async (context) => {
    let job = await acquire(context, input);
    await assert.rejects(
      executeExternalClaim(context, job, async () => {
        throw new Error("domain approval denied");
      }),
      /approval denied/,
    );
    assert.deepEqual(await state(), { receipts: 0, effects: 0, status: "processing" });
    await releaseExecution(context.client, job);
    await fixture.source.query(
      "UPDATE platform.outbox SET next_attempt_at=clock_timestamp() WHERE id=$1",
      [job.id],
    );
    job = await acquire(context, input);
    await assert.rejects(
      executeExternalClaim(context, job, async (ctx) => {
        await transaction(ctx.client, () =>
          ctx.client.query("INSERT INTO platform.probe_effects(operation_id) VALUES ($1)", [
            job.operationId,
          ]),
        );
        throw new Error("uncertain after committed domain effect");
      }),
      /uncertain/,
    );
    assert.deepEqual(await state(), { receipts: 0, effects: 1, status: "processing" });
    await releaseExecution(context.client, job);
    await fixture.source.query(
      "UPDATE platform.outbox SET next_attempt_at=clock_timestamp() WHERE id=$1",
      [job.id],
    );
    job = await acquire(context, input);
    assert.equal(
      await executeExternalClaim(context, job, async (ctx) => {
        // Synthetic domain reconciliation observes its durable checkpoint, not a fake provider success.
        const effect = await ctx.client.query(
          "SELECT 1 FROM platform.probe_effects WHERE operation_id=$1",
          [job.operationId],
        );
        assert.equal(effect.rows.length, 1);
      }),
      "succeeded",
    );
  });
  assert.deepEqual(await state(), { receipts: 1, effects: 1, status: "succeeded" });
});

test("concurrent duplicate acquisition is busy; superseded effect cannot checkpoint or release new lease", async () => {
  const input = await seed();
  const claims = await Promise.all(
    [0, 1].map(() => fixture.runtime("jobs", (ctx) => acquire(ctx, input))),
  );
  assert.equal(claims.filter((claim) => claim === "busy").length, 1);
  const old = claims.find((claim) => typeof claim === "object");
  await fixture.runtime("jobs", async (context) => {
    let current;
    assert.equal(
      await executeExternalClaim(context, old, async () => {
        await fixture.source.query(
          "UPDATE platform.outbox SET lease_until=clock_timestamp()-interval '1 second', next_attempt_at=clock_timestamp() WHERE id=$1",
          [old.id],
        );
        current = await fixture.runtime("jobs", (ctx) => acquire(ctx, input));
        assert.equal(typeof current, "object");
        assert.notEqual(current.leaseToken, old.leaseToken);
      }),
      "stale",
    );
    await releaseExecution(context.client, old);
    assert.equal(
      (await fixture.source.query("SELECT lease_token FROM platform.outbox WHERE id=$1", [old.id]))
        .rows[0].lease_token,
      current.leaseToken,
    );
    assert.deepEqual(await state(), { receipts: 0, effects: 0, status: "processing" });
    assert.equal(await executeExternalClaim(context, current, async () => {}), "succeeded");
  });
});

test("deadline passing after domain work is stale, never success or an invented receipt", async () => {
  const input = await seed();
  await fixture.runtime("jobs", async (context) => {
    const job = await acquire(context, input);
    assert.equal(
      await executeExternalClaim(context, job, async () => {
        await fixture.source.query(
          "UPDATE platform.outbox SET deadline_at=clock_timestamp()-interval '1 millisecond' WHERE id=$1",
          [job.id],
        );
      }),
      "stale",
    );
  });
  assert.deepEqual(await state(), { receipts: 0, effects: 0, status: "processing" });
});

test("ten-second signal cancels a stalled response body without acknowledging success", {
  timeout: 20000,
}, async () => {
  const input = await seed();
  const server = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.write("unfinished synthetic provider response");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await fixture.runtime("jobs", async (context) => {
      const job = await acquire(context, input);
      await assert.rejects(
        executeExternalClaim(context, job, async (_ctx, _job, signal) => {
          const response = await fetch(`http://127.0.0.1:${server.address().port}`, { signal });
          await response.text();
        }),
        (error) => ["AbortError", "TimeoutError"].includes(error.name),
      );
      assert.deepEqual(await state(), { receipts: 0, effects: 0, status: "processing" });
      await releaseExecution(context.client, job);
      assert.equal((await state()).status, "pending");
    });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("deadline sweep dead-letters financial review but still suppresses ordinary work", async () => {
  const financial = await seed({ deadlineAt: new Date(Date.now() - 100) });
  const ordinary = await seed({ kind: "platform.probe", deadlineAt: new Date(Date.now() - 100) });
  await fixture.source.query("INSERT INTO core.outbox_review_obligation VALUES ($1,'unresolved')", [
    financial.operationId,
  ]);
  await fixture.runtime("jobs", async (context) => {
    assert.deepEqual(await claimDue(context.client), []);
    assert.equal(await acquire(context, financial), "terminal");
    assert.equal(await acquire(context, ordinary), "terminal");
  });
  const rows = (
    await fixture.source.query(
      "SELECT id,status,failure_code,completed_at FROM platform.outbox ORDER BY id",
    )
  ).rows;
  assert.deepEqual(
    rows.find((row) => row.id === financial.id),
    {
      id: financial.id,
      status: "dead",
      failure_code: "financial_review_required",
      completed_at: null,
    },
  );
  assert.deepEqual(
    rows.find((row) => row.id === ordinary.id),
    { id: ordinary.id, status: "suppressed", failure_code: "deadline_elapsed", completed_at: null },
  );
  assert.equal(
    (
      await fixture.source.query(
        "SELECT outcome FROM core.outbox_review_obligation WHERE operation_id=$1",
        [financial.operationId],
      )
    ).rows[0].outcome,
    "unresolved",
  );
  assert.equal((await state()).receipts, 0);
  assert.equal((await state()).effects, 0);
});

for (const mode of ["transactional", "external"]) {
  test(`${mode} pre-effect financial expiry is dead/review, ordinary expiry remains suppressed`, async () => {
    for (const kind of ["commerce.reconcile", "platform.probe"]) {
      const input = await seed({ kind, deadlineAt: new Date(Date.now() - 100) });
      await fixture.runtime("jobs", async (context) => {
        const job = await acquire(context, input);
        const never = async () => assert.fail("expired work must not execute");
        const result =
          mode === "external"
            ? await executeExternalClaim(context, job, never)
            : await executeClaim(context, job, { [kind]: { decide: never, apply: never } });
        assert.equal(result, kind === "commerce.reconcile" ? "dead" : "suppressed");
      });
    }
    assert.equal((await state()).receipts, 0);
    assert.equal((await state()).effects, 0);
  });
}

test("financial deadline after a committed domain effect preserves unresolved review, not success", async () => {
  const input = await seed();
  await fixture.source.query("INSERT INTO core.outbox_review_obligation VALUES ($1,'uncertain')", [
    input.operationId,
  ]);
  await fixture.runtime("jobs", async (context) => {
    const acquired = await acquire(context, input);
    const job = { ...acquired, deadlineAt: new Date(Date.now() + 1000) };
    await fixture.source.query("UPDATE platform.outbox SET deadline_at=$2 WHERE id=$1", [
      job.id,
      job.deadlineAt,
    ]);
    assert.equal(
      await executeExternalClaim(context, job, async (ctx, claimed, signal) => {
        await transaction(ctx.client, () =>
          ctx.client.query("INSERT INTO platform.probe_effects(operation_id) VALUES ($1)", [
            claimed.operationId,
          ]),
        );
        await fixture.source.query("SELECT pg_sleep(1.1)");
        signal.throwIfAborted();
      }),
      "dead",
    );
    assert.equal(await acquire(context, input), "terminal");
  });
  assert.deepEqual(await state(), { receipts: 0, effects: 1, status: "dead" });
  const row = (
    await fixture.source.query(
      "SELECT failure_code,completed_at FROM platform.outbox WHERE id=$1",
      [input.id],
    )
  ).rows[0];
  assert.deepEqual(row, { failure_code: "financial_review_required", completed_at: null });
  assert.equal(
    (
      await fixture.source.query(
        "SELECT outcome FROM core.outbox_review_obligation WHERE operation_id=$1",
        [input.operationId],
      )
    ).rows[0].outcome,
    "uncertain",
  );
});
