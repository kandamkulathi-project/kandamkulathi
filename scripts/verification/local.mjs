import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  artifactsSnapshot,
  digest,
  git,
  inside,
  localInputs,
  repository,
  requireCommitted,
  snapshot,
  sourceSnapshot,
  validateBinding,
} from "./evidence.mjs";

export function verifyLocal(args = []) {
  assert.equal(args.length, 0, "No flags/approval/command overrides are supported");
  const before = sourceSnapshot();
  requireCommitted(before);
  const inputs = localInputs();
  const pin = readFileSync(join(repository, ".node-version"), "utf8").trim();
  assert.equal(process.versions.node, pin, "Use the exact pinned Node runtime");
  const history = digest(git(repository, ["show-ref"]));
  const startedAt = new Date().toISOString();
  const runId = randomUUID();
  const folder = inside(
    repository,
    `private-evidence/P1-DEV-090/${startedAt.replaceAll(":", "-")}-${runId}`,
  );
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  const report = {
    format: 1,
    runId,
    scope: "local-only",
    phaseDecision: "not-issued",
    cloudSetup: "pending",
    canonicalAcceptance: "pending",
    startedAt,
    localStatus: "running",
    source: before,
    localInputs: inputs,
    runtime: {
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
      packageManagerPin: JSON.parse(readFileSync(join(repository, "package.json"), "utf8"))
        .packageManager,
    },
    historyRefsSha256: history,
    commands: [],
  };
  try {
    // Reuse the mandatory gate; do not maintain a second weaker list or bypass its checks.
    for (const [name, script, extra] of [
      ["complete-commit-gate", "scripts/security/pre-commit.mjs", []],
      ["full-history-and-index-secrets", "scripts/security/scan.mjs", ["secrets"]],
    ]) {
      const log = `${name}.log`;
      const fd = openSync(join(folder, log), "wx", 0o600);
      console.log(`P1 local verification: ${name} started; restricted log in evidence folder.`);
      let result;
      const start = new Date().toISOString();
      try {
        result = spawnSync(process.execPath, [join(repository, script), ...extra], {
          cwd: repository,
          stdio: ["ignore", fd, fd],
          timeout: 20 * 60 * 1000,
          env: {
            ...process.env,
            KANDAMKULATHI_VERIFICATION_RUN_ID: runId,
            WRANGLER_SEND_METRICS: "false",
            ASTRO_TELEMETRY_DISABLED: "1",
            EXPO_NO_TELEMETRY: "1",
          },
        });
      } finally {
        closeSync(fd);
      }
      report.commands.push({
        name,
        startedAt: start,
        endedAt: new Date().toISOString(),
        status: !result.error && result.status === 0 ? "passed" : "failed",
        log,
        logSha256: digest(readFileSync(join(folder, log))),
      });
      assert(!result.error && result.status === 0, `${name} failed; inspect restricted evidence`);
    }
    assert.deepEqual(sourceSnapshot(), before, "Source/index/branch changed during verification");
    assert.deepEqual(localInputs(), inputs, "Local configuration changed during verification");
    assert.equal(
      digest(git(repository, ["show-ref"])),
      history,
      "Git refs changed during history verification",
    );
    const binding = JSON.parse(
      readFileSync(inside(repository, "test-results/p1-candidate-binding.json"), "utf8"),
    );
    validateBinding(binding, snapshot(), runId);
    report.artifacts = artifactsSnapshot();
    writeFileSync(join(folder, "browser-binding.json"), `${JSON.stringify(binding, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    });
    report.browserEvidence = {
      path: "browser-binding.json",
      sha256: digest(readFileSync(join(folder, "browser-binding.json"))),
    };
    report.localStatus = "passed";
  } catch {
    report.localStatus = "failed";
    report.failure =
      "A command, source/build parity or evidence validation failed. Inspect restricted logs; do not promote.";
  }
  report.endedAt = new Date().toISOString();
  writeFileSync(join(folder, "manifest.json"), `${JSON.stringify(report, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  writeFileSync(
    join(folder, "SUMMARY.md"),
    [
      "# P1-DEV-090 local verification",
      "",
      `Local checks: **${report.localStatus}**. G1 decision: **not issued**.`,
      `Cloud setup and canonical acceptance remain **Pending**.`,
      "",
      `Candidate: ${before.head}`,
      `Git tree: ${before.tree}`,
      `Run: ${runId}`,
      `Started: ${startedAt}`,
      `Ended: ${report.endedAt}`,
      "",
      "See manifest.json for source/build and restricted command-log hashes. These are integrity records, not signatures or independent approval.",
      "No cloud, real PostgreSQL/provider, signed native device, load/queue/restore/rollback, clinical/company or G1 acceptance is granted.",
      "",
    ].join("\n"),
    { flag: "wx", mode: 0o600 },
  );
  console.log(`Local verification ${report.localStatus}; evidence: ${folder}; G1 remains Pending.`);
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = verifyLocal(process.argv.slice(2)).localStatus === "passed" ? 0 : 1;
  } catch {
    console.error(
      "Verification precondition failed: use pinned tools, a clean committed candidate, default secret-free local inputs and no overrides.",
    );
    process.exitCode = 1;
  }
}
