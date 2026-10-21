import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { once } from "node:events";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { finished, pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";
import { roleProofSql } from "../../packages/database/src/roles.ts";
import {
  digest,
  installedMigrations,
  migrationFiles,
  migrationSet,
  operationTarget,
  withAdmin,
} from "./database.mjs";
import { privatePath } from "./files.mjs";
import { readManifest } from "./manifest.mjs";

const magic = Buffer.from("KAVB001\n");
const maxHeader = 64 * 1024;
const toolEnvironment = () =>
  Object.fromEntries(
    Object.entries(process.env).filter(([key]) =>
      [
        "PATH",
        "SYSTEMROOT",
        "WINDIR",
        "TEMP",
        "TMP",
        "HOME",
        "USERPROFILE",
        "APPDATA",
        "LANG",
        "LC_ALL",
        "PGSSLROOTCERT",
      ].includes(key.toUpperCase()),
    ),
  );
const binary = (name) => {
  let command;
  switch (name) {
    case "pg_dump":
      command = join(
        process.env.PG_BIN_DIR ?? "",
        process.platform === "win32" ? "pg_dump.exe" : "pg_dump",
      );
      break;
    case "pg_restore":
      command = join(
        process.env.PG_BIN_DIR ?? "",
        process.platform === "win32" ? "pg_restore.exe" : "pg_restore",
      );
      break;
    default:
      throw new Error("Unapproved database executable");
  }
  const version = spawnSync(command, ["--version"], {
    env: toolEnvironment(),
    encoding: "utf8",
    windowsHide: true,
    timeout: 10000,
  });
  assert.equal(version.status, 0, "PostgreSQL client tool unavailable");
  assert.match(version.stdout, /\(PostgreSQL\) 17\./, "Matching PostgreSQL 17 client required");
  return command;
};
const databaseIdentity = (url) => digest(`${url.hostname}:${url.port || "5432"}${url.pathname}`);
const keyBytes = (key) => {
  assert(
    typeof key === "string" && /^[A-Za-z0-9+/]{43}=$/.test(key),
    "A 32-byte recovery key is required",
  );
  const bytes = Buffer.from(key, "base64");
  assert.equal(bytes.length, 32);
  return bytes;
};
const childEnvironment = (url) => ({
  ...toolEnvironment(),
  PGHOST: url.hostname,
  PGPORT: url.port || "5432",
  PGDATABASE: url.pathname.slice(1),
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGSSLMODE: url.hostname.endsWith(".neon.tech") ? "verify-full" : "disable",
});
const launch = (name, args, url) => {
  const options = {
    env: childEnvironment(url),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    timeout: 300000,
  };
  let child;
  switch (name) {
    case "pg_dump":
      child = spawn(binary("pg_dump"), args, options);
      break;
    case "pg_restore":
      child = spawn(binary("pg_restore"), args, options);
      break;
    default:
      throw new Error("Unapproved database executable");
  }
  child.stderr.on("data", () => {}); // Consume privately; database errors never enter telemetry/evidence.
  const completed = once(child, "exit").then(([code]) =>
    assert.equal(code, 0, "PostgreSQL export/restore failed"),
  );
  // Attach immediately so a spawn failure cannot become an unhandled rejection while streaming.
  completed.catch(() => {});
  return { child, completed };
};

export async function controlTotals(client) {
  const counts = (
    await client.query(`SELECT (SELECT count(*)::integer FROM platform.outbox) AS outbox,
    (SELECT count(*)::integer FROM platform.receipts) AS receipts,
    (SELECT count(*)::integer FROM platform.probe_effects) AS effects,
    (SELECT count(*)::integer FROM public.k_platform_migrations) AS migrations`)
  ).rows[0];
  const states = (
    await client.query(
      "SELECT status,count(*)::integer AS count FROM platform.outbox GROUP BY status ORDER BY status",
    )
  ).rows;
  return { ...counts, states };
}

export async function exportEncrypted({
  connectionString,
  environment,
  namespace,
  manifest,
  output,
  key,
  keyId,
  objects = [],
}) {
  privatePath(output);
  const url = operationTarget(connectionString, environment, manifest);
  assert(output && !existsSync(output), "Refuse to overwrite an existing backup");
  assert.match(keyId, /^[a-z0-9-]{3,80}$/, "Recovery key reference required");
  const secret = keyBytes(key);
  assert(Array.isArray(objects) && objects.length <= 5000, "Object manifest is bounded");
  for (const object of objects) {
    assert(
      Object.keys(object).sort().join(",") === "bucket,key,sha256,size",
      "Invalid object manifest fields",
    );
    assert(
      [`${namespace}-private`, `${namespace}-public`].includes(object.bucket),
      "Wrong object namespace",
    );
    assert.match(
      object.key,
      /^sha256\/[a-f0-9]{64}$/,
      "Immutable content-addressed object key required",
    );
    assert.equal(object.sha256, object.key.slice(7), "Object content hash mismatch");
    assert(Number.isSafeInteger(object.size) && object.size >= 0, "Object byte size required");
  }
  mkdirSync(dirname(resolve(output)), { recursive: true });
  const partial = `${output}.partial`;
  assert(!existsSync(partial), "Incomplete previous export requires investigation");
  return withAdmin(connectionString, async (client) => {
    assert.equal(
      Math.floor(
        Number((await client.query("SHOW server_version_num")).rows[0].server_version_num) / 10000,
      ),
      17,
      "PostgreSQL 17 required",
    );
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    try {
      const role = (await client.query(roleProofSql, ["k_backup_runtime"])).rows[0];
      assert(
        role?.permitted && !role.privileged && !role.owns_objects && role.major === 17,
        "Use the restricted non-owner backup login",
      );
      const target = (
        await client.query(
          "SELECT environment,namespace,dataset_class FROM platform.environment WHERE singleton",
        )
      ).rows[0];
      assert(
        target?.environment === environment &&
          target.namespace === namespace &&
          target.dataset_class === (environment === "production" ? "production" : "synthetic"),
        "Wrong source environment",
      );
      const snapshot = (await client.query("SELECT pg_export_snapshot() AS id")).rows[0].id;
      assert.match(snapshot, /^[A-F0-9]+-[A-F0-9]+-\d+$/i);
      const metadata = {
        version: 1,
        environment,
        namespace,
        keyId,
        createdAt: new Date().toISOString(),
        sourceIdentity: databaseIdentity(url),
        // This client and pg_dump share the exported repeatable-read snapshot. The operator's
        // checkout may be older; retain the actual ledger and refuse incompatible restoration.
        migrations: await installedMigrations(client),
        controlTotals: await controlTotals(client),
        objects,
      };
      const bytes = Buffer.from(JSON.stringify(metadata));
      assert(bytes.length <= maxHeader, "Recovery metadata too large");
      const length = Buffer.alloc(4);
      length.writeUInt32BE(bytes.length);
      const iv = randomBytes(12);
      const header = Buffer.concat([magic, length, bytes, iv]);
      const cipher = createCipheriv("aes-256-gcm", secret, iv);
      cipher.setAAD(header);
      const { child, completed } = launch(
        "pg_dump",
        ["--format=custom", "--no-owner", "--enable-row-security", `--snapshot=${snapshot}`],
        url,
      );
      const outputStream = createWriteStream(partial, { flags: "wx", mode: 0o600 });
      outputStream.write(header);
      try {
        await pipeline(child.stdout, cipher, outputStream, { end: false });
        outputStream.end(cipher.getAuthTag());
        await finished(outputStream);
        await completed;
      } catch (error) {
        child.kill();
        outputStream.destroy();
        throw error;
      }
      await client.query("COMMIT");
      renameSync(partial, output);
      const sha256 = await hashFile(output);
      const inventory = { ...metadata, sha256, bytes: statSync(output).size };
      writeFileSync(`${output}.manifest.json`, `${JSON.stringify(inventory, null, 2)}\n`, {
        flag: "wx",
        mode: 0o600,
      });
      return inventory;
    } catch (error) {
      await client.query("ROLLBACK");
      rmSync(partial, { force: true });
      throw error;
    }
  });
}

async function hashFile(path) {
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(path)) hash.update(bytes);
  return hash.digest("hex");
}

export async function restoreEncrypted({
  connectionString,
  environment,
  namespace,
  manifest,
  input,
  key,
}) {
  privatePath(input);
  const url = operationTarget(connectionString, environment, manifest);
  assert.notEqual(
    environment,
    "production",
    "P1 restore tooling is restricted to isolated nonproduction targets",
  );
  const inventory = JSON.parse(readFileSync(`${input}.manifest.json`, "utf8"));
  assert.equal(statSync(input).size, inventory.bytes, "Encrypted artifact size mismatch");
  assert.equal(await hashFile(input), inventory.sha256, "Encrypted artifact hash mismatch");
  const { open } = await import("node:fs/promises");
  const handle = await open(input, "r");
  let header;
  let metadata;
  let iv;
  let tag;
  let start;
  let end;
  try {
    const prefix = Buffer.alloc(12);
    await handle.read(prefix, 0, 12, 0);
    assert(prefix.subarray(0, 8).equals(magic), "Unknown backup envelope");
    const size = prefix.readUInt32BE(8);
    assert(size > 0 && size <= maxHeader);
    header = Buffer.alloc(12 + size + 12);
    await handle.read(header, 0, header.length, 0);
    metadata = JSON.parse(header.subarray(12, 12 + size).toString("utf8"));
    iv = header.subarray(12 + size);
    const bytes = (await handle.stat()).size;
    start = header.length;
    end = bytes - 17;
    assert(end >= start, "Truncated encrypted export");
    tag = Buffer.alloc(16);
    await handle.read(tag, 0, 16, bytes - 16);
  } finally {
    await handle.close();
  }
  const { sha256: _sha, bytes: _bytes, ...outerMetadata } = inventory;
  assert.deepEqual(metadata, outerMetadata, "Recovery inventory was modified");
  assert.equal(metadata.environment, environment, "Wrong recovery environment");
  assert.equal(metadata.namespace, namespace, "Wrong recovery namespace");
  assert.notEqual(
    metadata.sourceIdentity,
    databaseIdentity(url),
    "Restore must not overwrite its source",
  );
  assert.deepEqual(
    migrationSet(metadata.migrations),
    migrationSet(migrationFiles().map(({ id, sha256 }) => ({ id, sha256 }))),
    "Current candidate cannot validate this schema",
  );
  const plaintext = `${input}.restore-${randomBytes(8).toString("hex")}.dump`;
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyBytes(key), iv);
    decipher.setAAD(header);
    decipher.setAuthTag(tag);
    // Authenticate the ENTIRE export before executing a single restore statement.
    await pipeline(
      createReadStream(input, { start, end }),
      decipher,
      createWriteStream(plaintext, { flags: "wx", mode: 0o600 }),
    );
    return await withAdmin(connectionString, async (client) => {
      const tables =
        await client.query(`SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE c.relkind IN ('r','p') AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' LIMIT 1`);
      assert.equal(tables.rowCount, 0, "Restore requires a new empty isolated database");
      await client.query(
        readFileSync(
          new URL("../../packages/database/operations/roles.sql", import.meta.url),
          "utf8",
        ),
      );
      const { child, completed } = launch(
        "pg_restore",
        [
          "--exit-on-error",
          "--single-transaction",
          "--no-owner",
          `--dbname=${url.pathname.slice(1)}`,
          plaintext,
        ],
        url,
      );
      child.stdout.resume();
      await completed;
      // Authentication proves the declaration's origin, not that the dump contains that ledger.
      // Older buggy exports could carry matching counts with a different set or checksum.
      assert.deepEqual(
        await installedMigrations(client),
        migrationSet(metadata.migrations),
        "Restored migration set differs from authenticated metadata; quarantine this target",
      );
      assert.deepEqual(
        await controlTotals(client),
        metadata.controlTotals,
        "Restored control totals differ",
      );
      return {
        status: "restored",
        controlTotals: metadata.controlTotals,
        objects: metadata.objects,
      };
    });
  } finally {
    rmSync(plaintext, { force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [action, file] = process.argv.slice(2);
    assert(
      ["export", "restore"].includes(action) && file,
      "Explicit action and ignored artifact path required",
    );
    const environment = process.env.APP_ENV;
    const manifest =
      environment === "local"
        ? undefined
        : readManifest(process.env.PLATFORM_MANIFEST, { provisioned: true });
    if (environment !== "local")
      assert(
        process.env.CHANGE_REVIEW_REFERENCE?.startsWith("https://"),
        "Independent operation review required",
      );
    const common = {
      connectionString: process.env.DATABASE_BACKUP_URL,
      environment,
      namespace: manifest?.namespace ?? "kandamkulathi-local",
      manifest,
      key: process.env.BACKUP_KEY_B64,
    };
    const result =
      action === "export"
        ? await exportEncrypted({
            ...common,
            output: file,
            keyId: process.env.BACKUP_KEY_ID,
            objects: process.env.R2_OBJECT_MANIFEST
              ? JSON.parse(readFileSync(process.env.R2_OBJECT_MANIFEST, "utf8"))
              : [],
          })
        : await restoreEncrypted({
            ...common,
            connectionString: process.env.DATABASE_RESTORE_URL,
            input: file,
          });
    console.log(
      JSON.stringify({
        environment,
        status: action === "export" ? "exported" : result.status,
        controlTotals: result.controlTotals,
      }),
    );
  } catch {
    console.error(
      "Recovery operation refused or failed. Check isolated target, restricted role, key, artifact authentication, tools and matching control totals privately.",
    );
    process.exitCode = 1;
  }
}
