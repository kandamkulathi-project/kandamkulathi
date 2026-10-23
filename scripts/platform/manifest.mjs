import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Operator manifest contains identifiers only. Credentials are supplied separately by secret storage. */
export function validateManifest(value, { provisioned = false } = {}) {
  assert.equal(value.schemaVersion, 1, "Unsupported resource manifest");
  assert(
    ["preview", "dev", "staging", "production"].includes(value.environment),
    "Explicit target required",
  );
  const namespace = `kandamkulathi-${value.environment}`;
  assert(
    value.namespace === namespace ||
      (value.environment === "preview" &&
        /^kandamkulathi-preview-[a-z0-9-]{1,24}$/.test(value.namespace)),
    "Wrong namespace",
  );
  assert.equal(
    value.providerMode,
    value.environment === "production" ? "live" : "sandbox",
    "Wrong provider mode",
  );
  assert.equal(value.database.majorVersion, 17, "PostgreSQL 17 required");
  assert.equal(value.database.runtimeRole, "k_core_login", "Wrong API role");
  assert.equal(value.database.workerRole, "k_jobs_login", "Wrong dispatcher role");
  assert.deepEqual(
    Object.keys(value.resources).sort(),
    [
      "coreWorker",
      "companionWorker",
      "publicBucket",
      "privateBucket",
      "financialQueue",
      "clinicalQueue",
      "engagementQueue",
      "financialDlq",
      "clinicalDlq",
      "engagementDlq",
    ].sort(),
    "Incomplete resource inventory",
  );
  const expected = {
    coreWorker: "core-api",
    companionWorker: "companion",
    publicBucket: "public",
    privateBucket: "private",
    financialQueue: "financial",
    clinicalQueue: "clinical",
    engagementQueue: "engagement",
    financialDlq: "financial-dlq",
    clinicalDlq: "clinical-dlq",
    engagementDlq: "engagement-dlq",
  };
  for (const [key, suffix] of Object.entries(expected)) {
    assert.equal(
      value.resources[key],
      `${value.namespace}-${suffix}`,
      "Resource crosses environment boundary",
    );
  }
  assert.equal(new Set(Object.values(value.resources)).size, 10, "Resources must be distinct");
  if (provisioned) {
    assert.equal(value.status, "provisioned", "Resource provisioning evidence required");
    assert.match(value.accountId, /^[0-9a-f]{32}$/, "Actual company Cloudflare account required");
    assert.match(
      value.database.runtimeHost,
      /^[a-z0-9-]+-pooler\.[a-z0-9.-]+\.neon\.tech$/,
      "Actual pooled endpoint required",
    );
    assert.equal(
      value.database.adminHost,
      value.database.runtimeHost.replace("-pooler.", "."),
      "Direct endpoint must match pooled endpoint",
    );
    assert.match(value.database.name, /^[a-z][a-z0-9_]{2,62}$/, "Actual database name required");
    assert.match(
      value.evidenceReference,
      /^https:\/\/[^\s]+$/,
      "Restricted provisioning/review evidence required",
    );
    assert(
      value.database.region && value.database.projectId && value.database.branchId,
      "Actual database isolation/region required",
    );
  } else assert(["planned", "provisioned"].includes(value.status), "Manifest status required");
  return value;
}

export function readManifest(path, options) {
  return validateManifest(JSON.parse(readFileSync(path, "utf8")), options);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const manifest = readManifest(process.argv[2], {
      provisioned: process.argv.includes("--provisioned"),
    });
    console.log(
      JSON.stringify({ environment: manifest.environment, status: manifest.status, valid: true }),
    );
  } catch {
    console.error(
      "Invalid manifest: supply a reviewed, isolated resource inventory; no credentials are printed.",
    );
    process.exitCode = 1;
  }
}
