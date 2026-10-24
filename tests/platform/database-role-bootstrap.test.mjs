import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import {
  installedMigrations,
  migrate,
  migrationFiles,
  withAdmin,
} from "../../scripts/platform/database.mjs";
import { testDatabase } from "./support.mjs";

const rolesSql = readFileSync(
  new URL("../../packages/database/operations/roles.sql", import.meta.url),
  "utf8",
);
let fixture;
let otherDatabase;
before(
  async () => {
    fixture = await testDatabase();
    otherDatabase = await fixture.makeDatabase();
  },
  { timeout: 30000 },
);
after(async () => fixture?.close());

async function clonedRoles(callback) {
  const suffix = randomBytes(8).toString("hex");
  const names = ["core", "jobs", "backup"].map(
    (profile) => `k_test_bootstrap_${suffix}_${profile}`,
  );
  let sql = rolesSql;
  for (const [index, profile] of ["core", "jobs", "backup"].entries())
    sql = sql.replaceAll(`k_${profile}_runtime`, names[index]);
  try {
    await callback({ names, sql });
  } finally {
    for (const name of names) {
      assert.match(name, /^k_test_bootstrap_[a-f0-9]{16}_(core|jobs|backup)$/);
      await fixture.source.query(`DROP ROLE IF EXISTS ${name}`);
    }
  }
}

async function safeProfiles(names) {
  const result = await fixture.source.query(
    `SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,
      EXISTS (SELECT 1 FROM pg_roles d WHERE d.oid<>r.oid AND pg_has_role(r.oid,d.oid,'MEMBER')) AS member
      FROM pg_roles r WHERE rolname=ANY($1::text[]) ORDER BY rolname`,
    [names],
  );
  assert.deepEqual(
    result.rows,
    [...names].sort().map((rolname) => ({
      rolname,
      rolcanlogin: false,
      rolsuper: false,
      rolcreatedb: false,
      rolcreaterole: false,
      rolreplication: false,
      rolbypassrls: false,
      member: false,
    })),
  );
}

// An uncommitted winner makes the loser's IF NOT EXISTS true. Wait for the
// actual catalogue conflict before releasing it, rather than relying on sleeps.
async function collide(sql, prepareWinner, checkLoser) {
  await withAdmin(fixture.sourceUrl, (left) =>
    withAdmin(otherDatabase, async (right) => {
      const leftPid = (await left.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      const rightPid = (await right.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      await left.query("BEGIN");
      await right.query("BEGIN");
      let pending;
      try {
        await left.query("SET LOCAL lock_timeout = '5s'");
        await right.query("SET LOCAL lock_timeout = '5s'");
        // Both succeed: this existing lock cannot protect cluster-global roles.
        await left.query("SELECT pg_advisory_xact_lock(871295, 1)");
        await right.query("SELECT pg_advisory_xact_lock(871295, 1)");
        await prepareWinner(left);
        pending = right.query(sql).then(
          () => ({ error: null }),
          (error) => ({ error }),
        );
        const deadline = Date.now() + 3000;
        let blocked = false;
        while (Date.now() < deadline) {
          const result = await fixture.source.query(
            "SELECT $1::integer=ANY(pg_blocking_pids($2)) AS blocked",
            [leftPid, rightPid],
          );
          if (result.rows[0].blocked) {
            blocked = true;
            break;
          }
          await delay(10);
        }
        assert.equal(
          blocked,
          true,
          "Loser must reach the real cross-database CREATE ROLE conflict",
        );
        await left.query("COMMIT");
        const outcome = await pending;
        await checkLoser(outcome);
        if (!outcome.error) await right.query("COMMIT");
      } finally {
        await left.query("ROLLBACK");
        await right.query("ROLLBACK");
        await pending;
      }
    }),
  );
}

test("each profile survives an actual cross-database CREATE ROLE collision and validates all three roles", async () => {
  for (let collision = 0; collision < 3; collision++) {
    await clonedRoles(async ({ names, sql }) => {
      // Earlier profiles already exist, forcing the collision at each CREATE.
      for (const name of names.slice(0, collision))
        await fixture.source.query(`CREATE ROLE ${name} NOLOGIN`);
      await collide(
        sql,
        (left) => left.query(`CREATE ROLE ${names[collision]} NOLOGIN`),
        async ({ error }) => {
          assert.equal(error, null);
        },
      );
      // The loser must continue after the collision and create remaining profiles.
      await safeProfiles(names);
      await fixture.source.query(sql);
      await safeProfiles(names);
    });
  }
});

test("a concurrent winner's unsafe role or inherited membership is rejected, not accepted as a duplicate", async () => {
  await clonedRoles(async ({ names, sql }) => {
    await collide(
      sql,
      (left) => left.query(`CREATE ROLE ${names[0]} LOGIN`),
      async ({ error }) => {
        assert.match(error?.message ?? "", /Unsafe existing platform role/);
      },
    );
  });
  await clonedRoles(async ({ names, sql }) => {
    await fixture.source.query(`CREATE ROLE ${names[2]} NOLOGIN`);
    await collide(
      sql,
      async (left) => {
        await left.query(`CREATE ROLE ${names[0]} NOLOGIN`);
        await left.query(`GRANT ${names[2]} TO ${names[0]}`);
      },
      async ({ error }) => {
        assert.match(error?.message ?? "", /Runtime profiles must not inherit other roles/);
      },
    );
  });
});

test("all existing profile flags remain fail-closed and unrelated CREATE errors are propagated", async () => {
  await clonedRoles(async ({ names, sql }) => {
    await fixture.source.query(sql);
    for (const name of names) {
      for (const flag of [
        "LOGIN",
        "SUPERUSER",
        "CREATEDB",
        "CREATEROLE",
        "REPLICATION",
        "BYPASSRLS",
      ]) {
        await fixture.source.query(`ALTER ROLE ${name} ${flag}`);
        try {
          await assert.rejects(fixture.source.query(sql), /Unsafe existing platform role/);
        } finally {
          await fixture.source.query(`ALTER ROLE ${name} NO${flag}`);
        }
      }
    }
    await safeProfiles(names);
  });
  await clonedRoles(async ({ names, sql }) => {
    await fixture.source.query(`CREATE ROLE ${names[2]} NOLOGIN`);
    await withAdmin(otherDatabase, async (client) => {
      await client.query("BEGIN");
      try {
        await client.query(`SET LOCAL ROLE ${names[2]}`);
        await assert.rejects(client.query(sql), (error) => error.code === "42501");
      } finally {
        await client.query("ROLLBACK");
      }
    });
    assert.equal(
      (
        await fixture.source.query("SELECT 1 FROM pg_roles WHERE rolname=ANY($1::text[])", [
          names.slice(0, 2),
        ])
      ).rowCount,
      0,
    );
  });
});

test("concurrent real migrations across isolated databases install the complete immutable ledger and retry identically", async () => {
  const targets = await Promise.all([fixture.makeDatabase(), fixture.makeDatabase()]);
  const options = { environment: "local", namespace: "kandamkulathi-local" };
  const expected = migrationFiles().map(({ id, sha256 }) => ({ id, sha256 }));
  const results = await Promise.all(targets.map((target) => migrate(target, options)));
  assert.deepEqual(results, [expected, expected]);
  for (const target of targets) {
    await withAdmin(target, async (client) => {
      assert.deepEqual(await installedMigrations(client), expected);
      assert.equal(
        (await client.query("SELECT namespace FROM platform.environment WHERE singleton")).rows[0]
          .namespace,
        options.namespace,
      );
    });
  }
  assert.deepEqual(await Promise.all(targets.map((target) => migrate(target, options))), [
    expected,
    expected,
  ]);
});
