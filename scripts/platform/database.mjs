import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { readManifest } from "./manifest.mjs";

export const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const base = new URL("../../packages/database/", import.meta.url);
export const migrationFiles = () => {
  const journal = JSON.parse(readFileSync(new URL("migrations/meta/_journal.json", base)));
  return journal.entries.map((entry) => {
    assert.match(entry.tag, /^\d{4}_[a-z0-9_]+$/);
    const sql = readFileSync(new URL(`migrations/${entry.tag}.sql`, base), "utf8");
    return { id: entry.tag, sql, sha256: digest(sql.replaceAll("\r\n", "\n")) };
  });
};

/** Canonical installed ledger identity; counts alone cannot establish schema compatibility. */
export function migrationSet(rows) {
  assert(Array.isArray(rows) && rows.length > 0, "Migration ledger must be nonempty");
  const ids = new Set();
  const migrations = rows.map((row) => {
    assert(
      row && Object.keys(row).sort().join(",") === "id,sha256",
      "Invalid migration ledger fields",
    );
    assert(
      typeof row.id === "string" && /^\d{4}_[a-z0-9_]+$/.test(row.id),
      "Invalid migration identifier",
    );
    assert(
      typeof row.sha256 === "string" && /^[a-f0-9]{64}$/.test(row.sha256),
      "Invalid migration checksum",
    );
    assert(!ids.has(row.id), "Duplicate migration identifier");
    ids.add(row.id);
    return { id: row.id, sha256: row.sha256 };
  });
  return migrations.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

export async function installedMigrations(client) {
  return migrationSet(
    (await client.query("SELECT id,sha256 FROM public.k_platform_migrations")).rows,
  );
}

/** No output includes connection strings. Direct administrative access is separate from Worker secrets. */
export function operationTarget(value, environment, manifest) {
  const url = new URL(value);
  assert(
    ["postgres:", "postgresql:"].includes(url.protocol) &&
      url.username &&
      url.password &&
      !url.hash,
    "Invalid database target",
  );
  assert(/^\/[a-z][a-z0-9_]{2,62}$/.test(url.pathname), "Invalid database name");
  if (environment === "local") {
    assert(
      ["127.0.0.1", "localhost"].includes(url.hostname) &&
        /^\/k_platform_(test_[a-f0-9]+|local)$/.test(url.pathname) &&
        url.search === "",
      "Only explicitly isolated local databases are allowed",
    );
  } else {
    assert(
      manifest && manifest.environment === environment && manifest.status === "provisioned",
      "Reviewed provisioned inventory required",
    );
    assert.equal(url.hostname, manifest.database.adminHost, "Wrong direct database endpoint");
    assert.equal(url.pathname, `/${manifest.database.name}`, "Wrong database name");
    assert.equal(url.search, "?sslmode=verify-full", "Verified administrative TLS required");
    assert(
      !url.hostname.includes("-pooler."),
      "Administrative operations require the direct endpoint",
    );
  }
  return url;
}

export async function withAdmin(value, callback) {
  const client = new pg.Client({
    connectionString: value,
    connectionTimeoutMillis: 5000,
    query_timeout: 30000,
    application_name: "kandamkulathi-controlled-platform-runner",
  });
  try {
    await client.connect();
    return await callback(client);
  } finally {
    await client.end();
  }
}

export async function migrate(value, { environment, namespace, manifest } = {}) {
  operationTarget(value, environment, manifest);
  assert.equal(
    namespace,
    manifest?.namespace ?? `kandamkulathi-${environment}`,
    "Wrong migration namespace",
  );
  return withAdmin(value, async (client) => {
    assert.equal(
      (Number((await client.query("SHOW server_version_num")).rows[0].server_version_num) / 10000) |
        0,
      17,
      "PostgreSQL 17 required",
    );
    // Cluster-global profiles must commit before the longer, database-local migration
    // transaction. A failed migration may leave only validated NOLOGIN groups;
    // domain schema, grants and ledger still commit or roll back together below.
    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SET LOCAL statement_timeout = '30s'");
      await client.query(readFileSync(new URL("operations/roles.sql", base), "utf8"));
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SET LOCAL statement_timeout = '30s'");
      await client.query("SELECT pg_advisory_xact_lock(871295, 1)");
      // Tracking lives outside domain namespaces and contains only migration identifiers/digests.
      await client.query(`CREATE TABLE IF NOT EXISTS public.k_platform_migrations (
        id text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT clock_timestamp())`);
      await client.query("REVOKE ALL ON public.k_platform_migrations FROM PUBLIC");
      const applied = new Map(
        (await client.query("SELECT id,sha256 FROM public.k_platform_migrations")).rows.map(
          (row) => [row.id, row.sha256],
        ),
      );
      const files = migrationFiles();
      assert(
        [...applied.keys()].every((id) => files.some((file) => file.id === id)),
        "Database has unknown migrations; use a compatible candidate",
      );
      for (const file of files) {
        if (applied.has(file.id))
          assert.equal(applied.get(file.id), file.sha256, "Applied migration checksum changed");
        else {
          await client.query(file.sql);
          await client.query("INSERT INTO public.k_platform_migrations(id,sha256) VALUES ($1,$2)", [
            file.id,
            file.sha256,
          ]);
        }
      }
      await client.query(
        `INSERT INTO platform.environment(singleton,environment,namespace,dataset_class)
        VALUES(true,$1,$2,$3) ON CONFLICT(singleton) DO NOTHING`,
        [environment, namespace, environment === "production" ? "production" : "synthetic"],
      );
      const target = (
        await client.query("SELECT environment,namespace FROM platform.environment WHERE singleton")
      ).rows[0];
      assert(
        target.environment === environment && target.namespace === namespace,
        "Refuse migration of a different environment",
      );
      await client.query("GRANT SELECT ON public.k_platform_migrations TO k_backup_runtime");
      await client.query("COMMIT");
      return files.map(({ id, sha256 }) => ({ id, sha256 }));
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    assert.equal(process.argv[2], "migrate", "Explicit migrate subcommand required");
    const environment = process.env.APP_ENV;
    const manifest =
      environment === "local"
        ? undefined
        : readManifest(process.env.PLATFORM_MANIFEST, { provisioned: true });
    if (environment !== "local") {
      assert(
        process.env.CHANGE_REVIEW_REFERENCE?.startsWith("https://"),
        "Independent change review required",
      );
      assert.notEqual(
        environment,
        "production",
        "Production changes require the later phase release gate",
      );
    }
    const evidence = await migrate(process.env.DATABASE_MIGRATION_URL, {
      environment,
      namespace: manifest?.namespace ?? "kandamkulathi-local",
      manifest,
    });
    console.log(JSON.stringify({ environment, migrations: evidence, status: "applied" }));
  } catch {
    console.error(
      "Migration refused or failed. Verify isolated target, reviewed inventory, PostgreSQL version, roles and immutable migration checksums.",
    );
    process.exitCode = 1;
  }
}
