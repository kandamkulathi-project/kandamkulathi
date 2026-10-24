import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import pg from "pg";
import { migrate, migrationSet } from "../../scripts/platform/database.mjs";

const first = { id: "0000_first", sha256: "a".repeat(64) };
const second = { id: "0001_second", sha256: "b".repeat(64) };

test("migration identity is canonical without mutating input or replacing actual checksums", () => {
  const rows = [second, first];
  assert.deepEqual(migrationSet(rows), [first, second]);
  assert.deepEqual(rows, [second, first]);
  const changed = { ...first, sha256: "c".repeat(64) };
  assert.deepEqual(migrationSet([changed]), [changed]);
  assert.notDeepEqual(migrationSet([changed]), migrationSet([first]));
});

test("migration ledger rejects missing, malformed, duplicate and unexpected fields", () => {
  for (const rows of [
    null,
    [],
    [null],
    [first, first],
    [{ ...first, id: "../migration" }],
    [{ ...first, sha256: "invalid" }],
    [{ ...first, sha256: "A".repeat(64) }],
    [{ id: first.id }],
    [{ ...first, extra: "not-part-of-ledger-identity" }],
  ])
    assert.throws(() => migrationSet(rows));
});

const rolesSql = readFileSync(
  new URL("../../packages/database/operations/roles.sql", import.meta.url),
  "utf8",
);
const database = "postgresql://admin:synthetic@127.0.0.1/k_platform_test_ab12";
const options = { environment: "local", namespace: "kandamkulathi-local" };

function controlledRunner(context, fail) {
  const statements = [];
  let closed = false;
  context.mock.method(pg.Client.prototype, "connect", async () => {});
  context.mock.method(pg.Client.prototype, "end", async () => {
    closed = true;
  });
  context.mock.method(pg.Client.prototype, "query", async (sql) => {
    statements.push(sql);
    if (fail?.(sql)) throw new Error("synthetic migration failure");
    if (sql === "SHOW server_version_num") return { rows: [{ server_version_num: "170010" }] };
    if (sql.startsWith("SELECT environment,namespace"))
      return { rows: [{ environment: "local", namespace: "kandamkulathi-local" }] };
    return { rows: [] };
  });
  return { statements, closed: () => closed };
}

test("cluster role bootstrap commits before database locking and atomic schema/ledger work", async (context) => {
  const runner = controlledRunner(context);
  await migrate(database, options);
  const roles = runner.statements.indexOf(rolesSql);
  const lock = runner.statements.indexOf("SELECT pg_advisory_xact_lock(871295, 1)");
  assert.deepEqual(runner.statements.slice(0, roles + 2), [
    "SHOW server_version_num",
    "BEGIN",
    "SET LOCAL lock_timeout = '5s'",
    "SET LOCAL statement_timeout = '30s'",
    rolesSql,
    "COMMIT",
  ]);
  assert(roles < lock);
  assert.deepEqual(runner.statements.slice(roles + 2, lock), [
    "BEGIN",
    "SET LOCAL lock_timeout = '5s'",
    "SET LOCAL statement_timeout = '30s'",
  ]);
  assert.equal(runner.statements.at(-1), "COMMIT");
  assert.equal(runner.statements.filter((sql) => sql === "COMMIT").length, 2);
  assert.equal(runner.closed(), true);
});

test("unsafe/bootstrap failures roll back and never begin database schema work", async (context) => {
  const runner = controlledRunner(context, (sql) => sql === rolesSql);
  await assert.rejects(migrate(database, options), /synthetic migration failure/);
  assert.equal(runner.statements.at(-1), "ROLLBACK");
  assert.equal(runner.statements.includes("COMMIT"), false);
  assert.equal(runner.statements.filter((sql) => sql === "BEGIN").length, 1);
  assert.equal(
    runner.statements.some((sql) => sql.includes("CREATE TABLE")),
    false,
  );
  assert.equal(runner.closed(), true);
});

test("domain migration failure rolls back the schema boundary, not the committed role-only bootstrap", async (context) => {
  const runner = controlledRunner(context, (sql) =>
    sql.startsWith("CREATE TABLE IF NOT EXISTS public.k_platform_migrations"),
  );
  await assert.rejects(migrate(database, options), /synthetic migration failure/);
  assert.equal(runner.statements.at(-1), "ROLLBACK");
  assert.equal(runner.statements.filter((sql) => sql === "COMMIT").length, 1);
  assert.equal(runner.statements.filter((sql) => sql === "BEGIN").length, 2);
  assert.equal(runner.closed(), true);
});
