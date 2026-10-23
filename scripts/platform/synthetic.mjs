import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { operationTarget, withAdmin } from "./database.mjs";

/** Local synthetic transport fixtures only. Never reset a domain schema or a shared cloud environment. */
export async function syntheticFixtures(connectionString, action, namespace) {
  operationTarget(connectionString, "local");
  assert.equal(namespace, "kandamkulathi-local");
  assert(["seed", "reset-probes"].includes(action));
  return withAdmin(connectionString, async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL lock_timeout = '2s'");
      await client.query("SET LOCAL statement_timeout = '10s'");
      const target = (await client.query("SELECT * FROM platform.environment WHERE singleton"))
        .rows[0];
      assert(
        target.environment === "local" &&
          target.namespace === namespace &&
          target.dataset_class === "synthetic",
        "Refuse non-synthetic target",
      );
      let result;
      if (action === "seed") {
        const id = randomUUID();
        const operationId = randomUUID();
        await client.query("SET LOCAL ROLE k_core_runtime");
        await client.query(
          `INSERT INTO platform.outbox(id,operation_id,channel,kind,subject_id,revision,due_at,deadline_at,next_attempt_at)
          VALUES($1,$2,'financial','platform.probe',$3,1,clock_timestamp(),clock_timestamp()+interval '5 minutes',clock_timestamp())`,
          [id, operationId, "00000000-0000-4000-8000-000000000001"],
        );
        result = { status: "seeded", id, operationId, kind: "platform.probe" };
      } else {
        const busy = await client.query(
          "SELECT 1 FROM platform.outbox WHERE kind='platform.probe' AND lease_until>clock_timestamp() LIMIT 1",
        );
        assert.equal(busy.rowCount, 0, "Active probe leases must finish before reset");
        await client.query("DELETE FROM platform.receipts WHERE kind='platform.probe'");
        await client.query(
          "DELETE FROM platform.probe_effects WHERE operation_id IN (SELECT operation_id FROM platform.outbox WHERE kind='platform.probe')",
        );
        const deleted = await client.query(
          "DELETE FROM platform.outbox WHERE kind='platform.probe'",
        );
        result = { status: "reset-probes", deleted: deleted.rowCount };
      }
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    assert.equal(process.env.APP_ENV, "local", "Fixtures are local only");
    assert.equal(
      process.env.PLATFORM_CONFIRM_SYNTHETIC_NAMESPACE,
      "kandamkulathi-local",
      "Explicit local fixture confirmation required",
    );
    console.log(
      JSON.stringify(
        await syntheticFixtures(
          process.env.DATABASE_MIGRATION_URL,
          process.argv[2],
          process.env.PLATFORM_CONFIRM_SYNTHETIC_NAMESPACE,
        ),
      ),
    );
  } catch {
    console.error(
      "Synthetic fixture operation refused or failed. Check explicit isolated local target, migration and active leases.",
    );
    process.exitCode = 1;
  }
}
