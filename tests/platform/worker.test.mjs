import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import test from "node:test";
import { transaction } from "../../packages/database/src/client.ts";
import { enqueue } from "../../packages/database/src/outbox.ts";
import { testDatabase } from "./support.mjs";

test("real workerd Cron drains a 30-job spike across three Queues with one durable effect per job", {
  timeout: 90000,
}, async () => {
  const fixture = await testDatabase();
  const listener = createServer();
  await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  const directory = resolve(".local-data", `platform-worker-${randomBytes(6).toString("hex")}`);
  mkdirSync(directory, { recursive: true });
  const config = {
    name: "kandamkulathi-local-platform-test",
    main: resolve("apps/core-api/src/index.ts"),
    compatibility_date: "2026-10-19",
    compatibility_flags: ["nodejs_compat"],
    vars: {
      APP_ENV: "local",
      RESOURCE_NAMESPACE: "kandamkulathi-local",
      PROVIDER_MODE: "stub",
      ALLOW_LIVE_SENDS: "false",
      ALLOW_LIVE_PAYMENTS: "false",
    },
    queues: {
      producers: ["financial", "clinical", "engagement"].map((channel) => ({
        binding: `${channel.toUpperCase()}_QUEUE`,
        queue: `kandamkulathi-local-${channel}`,
      })),
      consumers: ["financial", "clinical", "engagement"].map((channel) => ({
        queue: `kandamkulathi-local-${channel}`,
        max_batch_size: 10,
        max_batch_timeout: 1,
        max_retries: 5,
        dead_letter_queue: `kandamkulathi-local-${channel}-dlq`,
      })),
    },
    triggers: { crons: ["* * * * *"] },
  };
  writeFileSync(resolve(directory, "wrangler.json"), JSON.stringify(config));
  writeFileSync(
    resolve(directory, ".dev.vars"),
    `DATABASE_WORKER_URL=${fixture.urls.jobs}\nLOCAL_DATABASE_PROXY=${fixture.localProxy}\n`,
    { mode: 0o600 },
  );
  const input = {
    id: randomUUID(),
    operationId: randomUUID(),
    subjectId: randomUUID(),
    revision: 1,
    kind: "platform.probe",
    channel: "financial",
    dueAt: new Date(Date.now() - 1000),
    deadlineAt: new Date(Date.now() + 60000),
  };
  await fixture.runtime("core", (context) =>
    transaction(context.client, () => enqueue(context, input)),
  );
  // The next real broker publication is the final permitted attempt. Subsequent channel
  // sweeps in the same Cron run must leave it deliverable until its consumer executes.
  await fixture.source.query("UPDATE platform.outbox SET publish_attempts=4 WHERE id=$1", [
    input.id,
  ]);
  await fixture.source.query(`INSERT INTO platform.outbox(id,operation_id,channel,kind,subject_id,revision,due_at,deadline_at,next_attempt_at)
    SELECT gen_random_uuid(),gen_random_uuid(),(ARRAY['financial','clinical','engagement'])[1+(i%3)],'platform.probe',gen_random_uuid(),1,
      clock_timestamp()-interval '1 second',clock_timestamp()+interval '5 minutes',clock_timestamp() FROM generate_series(1,29) i`);
  const output = [];
  const child = spawn(
    process.execPath,
    [
      resolve("apps/core-api/node_modules/wrangler/bin/wrangler.js"),
      "dev",
      "--local",
      "--test-scheduled",
      "--ip",
      "127.0.0.1",
      "--port",
      `${port}`,
      "--inspector-port",
      "0",
      "--config",
      resolve(directory, "wrangler.json"),
    ],
    {
      cwd: directory,
      env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "true", FORCE_COLOR: "0" },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (bytes) => output.push(bytes.toString()));
  child.stderr.on("data", (bytes) => output.push(bytes.toString()));
  try {
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      if (child.exitCode !== null)
        throw new Error("Local Worker exited; inspect its private test log.");
      try {
        if ((await fetch(`${base}/health/live`)).ok) {
          ready = true;
          break;
        }
      } catch {
        /* Startup only. */
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert(ready, "Local Worker failed to start");
    assert.equal((await fetch(`${base}/health/ready`)).status, 503);
    const started = Date.now();
    assert.equal(
      (await fetch(`${base}/cdn-cgi/handler/scheduled?cron=${encodeURIComponent("* * * * *")}`))
        .status,
      200,
    );
    let completed = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      const row = (
        await fixture.source.query("SELECT status FROM platform.outbox WHERE id=$1", [input.id])
      ).rows[0];
      const total = (
        await fixture.source.query(
          "SELECT count(*)::integer AS count FROM platform.outbox WHERE status='succeeded'",
        )
      ).rows[0].count;
      if (row.status === "succeeded" && total === 30) {
        completed = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert(completed, "Cron/Queue/driver transaction did not complete");
    assert.deepEqual(
      (
        await fixture.source.query(
          "SELECT publish_attempts,execution_attempts FROM platform.outbox WHERE id=$1",
          [input.id],
        )
      ).rows[0],
      { publish_attempts: 5, execution_attempts: 1 },
    );
    assert.equal(
      (await fixture.source.query("SELECT count(*)::integer AS count FROM platform.probe_effects"))
        .rows[0].count,
      30,
    );
    assert(Date.now() - started < 120000, "Synthetic healthy pickup exceeded its objective");
    await fetch(`${base}/cdn-cgi/handler/scheduled?cron=${encodeURIComponent("* * * * *")}`);
    assert.equal(
      (
        await fixture.source.query(
          "SELECT count(*)::integer AS count FROM platform.probe_effects WHERE operation_id=$1",
          [input.operationId],
        )
      ).rows[0].count,
      1,
    );
    assert.equal(
      (
        await fixture.source.query(
          "SELECT count(*)::integer AS count FROM platform.receipts WHERE job_id=$1",
          [input.id],
        )
      ).rows[0].count,
      1,
    );
    assert(
      !output.join("").includes(new URL(fixture.urls.jobs).password),
      "Runtime log leaked its database credential",
    );
  } finally {
    writeFileSync(resolve(directory, "worker.log"), output.join(""));
    if (process.platform === "win32") {
      const kill = spawn("taskkill", ["/pid", `${child.pid}`, "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
      await new Promise((resolve) => kill.once("close", resolve));
    } else {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("close", resolve));
    }
    await fixture.close();
  }
});
