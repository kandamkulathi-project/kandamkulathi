import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { digest, migrationFiles, operationTarget, withAdmin } from "./database.mjs";
import { privatePath } from "./files.mjs";
import { readManifest } from "./manifest.mjs";
import { renderConfig } from "./render-config.mjs";

export { privatePath } from "./files.mjs";

export function prepareArtifact({ sourceSha, manifest, output, bundles }) {
  assert.match(sourceSha, /^[a-f0-9]{40}$/);
  const destination = privatePath(output);
  assert(!existsSync(destination), "Never overwrite a release artifact");
  const files = [];
  for (const service of ["core-api", "companion"]) {
    const bytes = readFileSync(bundles[service]);
    assert(bytes.length > 0, "Worker bundle missing");
    const path = resolve(dirname(destination), `${service}.js`);
    assert(!existsSync(path), "Release directory already contains an artifact");
    mkdirSync(dirname(path), { recursive: true });
    copyFileSync(bundles[service], path);
    files.push({
      service,
      path: relative(dirname(destination), path).replaceAll("\\", "/"),
      sha256: digest(bytes),
      bytes: bytes.length,
    });
  }
  const artifact = {
    schemaVersion: 1,
    sourceSha,
    apiVersion: 1,
    namespace: manifest.namespace,
    environment: manifest.environment,
    inventorySha256: digest(JSON.stringify(manifest)),
    migrations: migrationFiles().map(({ id, sha256 }) => ({ id, sha256 })),
    files,
    nativeDeviceProof: "pending",
    productionAcceptance: "pending",
  };
  writeFileSync(destination, `${JSON.stringify(artifact, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  return artifact;
}

export function verifyArtifact(path, manifest) {
  const file = privatePath(path);
  const artifact = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(artifact.schemaVersion, 1);
  assert.equal(artifact.apiVersion, 1);
  assert.match(artifact.sourceSha, /^[a-f0-9]{40}$/);
  assert.equal(
    artifact.inventorySha256,
    digest(JSON.stringify(manifest)),
    "Inventory changed since build",
  );
  assert.equal(artifact.environment, manifest.environment);
  assert.equal(artifact.namespace, manifest.namespace);
  assert.deepEqual(artifact.files.map((entry) => entry.service).sort(), ["companion", "core-api"]);
  for (const entry of artifact.files) {
    assert.equal(entry.path, `${entry.service}.js`, "Unexpected release file");
    const bytes = readFileSync(resolve(dirname(file), entry.path));
    assert.equal(bytes.length, entry.bytes);
    assert.equal(digest(bytes), entry.sha256, "Release artifact changed");
  }
  return artifact;
}

/** Direct endpoint/session lock, distinct from application transactions. Never overlap one target. */
export async function withDeploymentLock(connectionString, callback) {
  return withAdmin(connectionString, async (client) => {
    const acquired = (await client.query("SELECT pg_try_advisory_lock(871295,2) AS acquired"))
      .rows[0].acquired;
    assert(acquired, "Another deployment/rollback holds this target's lock");
    try {
      return await callback(client);
    } finally {
      await client.query("SELECT pg_advisory_unlock(871295,2)");
    }
  });
}

/** Older binaries require matching old migration digests and an explicitly compatible current API range. */
export async function checkCompatibility(client, artifact) {
  const state = (await client.query("SELECT * FROM platform.environment WHERE singleton")).rows[0];
  assert(
    state && state.namespace === artifact.namespace && state.environment === artifact.environment,
    "Wrong release database",
  );
  assert(
    state.min_api_version <= artifact.apiVersion && state.max_api_version >= artifact.apiVersion,
    "Current schema rejects this API version",
  );
  const installed = new Map(
    (await client.query("SELECT id,sha256 FROM public.k_platform_migrations")).rows.map((row) => [
      row.id,
      row.sha256,
    ]),
  );
  for (const migration of artifact.migrations)
    assert.equal(
      installed.get(migration.id),
      migration.sha256,
      "Release schema is missing or changed",
    );
  return {
    compatible: true,
    apiVersion: artifact.apiVersion,
    platformVersion: state.platform_version,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [action, manifestPath, artifactPath] = process.argv.slice(2);
    assert(
      ["prepare", "check", "dry-run"].includes(action),
      "Explicit local release action required",
    );
    const manifest = readManifest(manifestPath);
    assert.notEqual(
      manifest.environment,
      "production",
      "P1 release tooling cannot operate production",
    );
    if (action === "prepare") {
      const status = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" });
      const revision = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
      assert.equal(status.status, 0);
      assert.equal(status.stdout.trim(), "", "Commit verified inputs before preparing a candidate");
      assert.equal(revision.status, 0);
      assert.equal(
        process.versions.node,
        readFileSync(".node-version", "utf8").trim(),
        "Use the pinned Node runtime",
      );
      for (const service of ["core-api", "companion"]) {
        const build = spawnSync(
          process.execPath,
          [
            resolve(`apps/${service}/node_modules/wrangler/bin/wrangler.js`),
            "deploy",
            "--config",
            resolve(`apps/${service}/wrangler.jsonc`),
            "--dry-run",
            "--outdir",
            resolve(`apps/${service}/dist`),
          ],
          { stdio: "inherit", windowsHide: true, timeout: 120000 },
        );
        assert.equal(build.status, 0, "Fresh Worker dry build required");
      }
      const unchanged = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" });
      assert.equal(unchanged.status, 0);
      assert.equal(unchanged.stdout.trim(), "", "Inputs changed during artifact preparation");
      const artifact = prepareArtifact({
        sourceSha: revision.stdout.trim(),
        manifest,
        output: artifactPath,
        bundles: {
          "core-api": "apps/core-api/dist/index.js",
          companion: "apps/companion/dist/index.js",
        },
      });
      console.log(
        JSON.stringify({
          status: "prepared",
          sourceSha: artifact.sourceSha,
          productionAcceptance: "pending",
        }),
      );
    } else {
      const artifact = verifyArtifact(artifactPath, manifest);
      if (action === "check") {
        operationTarget(process.env.DATABASE_MIGRATION_URL, manifest.environment, manifest);
        console.log(
          JSON.stringify(
            await withDeploymentLock(process.env.DATABASE_MIGRATION_URL, (client) =>
              checkCompatibility(client, artifact),
            ),
          ),
        );
      } else {
        for (const service of ["core-api", "companion"]) {
          const config = renderConfig(manifest, service);
          config.main = resolve(dirname(privatePath(artifactPath)), `${service}.js`);
          const path = resolve(dirname(privatePath(artifactPath)), `${service}.wrangler.json`);
          writeFileSync(path, JSON.stringify(config), { mode: 0o600 });
          const result = spawnSync(
            process.execPath,
            [
              resolve(`apps/${service}/node_modules/wrangler/bin/wrangler.js`),
              "deploy",
              "--config",
              path,
              "--dry-run",
              "--no-bundle",
              "--upload-source-maps=false",
            ],
            { stdio: "inherit", windowsHide: true, timeout: 120000 },
          );
          assert.equal(result.status, 0, "Frozen artifact dry build failed");
        }
      }
    }
  } catch {
    console.error(
      "Local release rehearsal refused or failed: check candidate integrity, target, compatibility and target lock. No remote deployment is performed.",
    );
    process.exitCode = 1;
  }
}
