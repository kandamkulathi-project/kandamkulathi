import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assessAudit, verifyInstalledPatches } from "./policy.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const evidence = join(root, "test-results", "dependency-audit.json");
mkdirSync(dirname(evidence), { recursive: true });
// A failed check must not expose an old successful run's evidence as current.
rmSync(evidence, { force: true });
const pm = process.env.npm_execpath;
assert(pm, "Run this verification through pnpm security:check");
const runPnpm = (args) =>
  spawnSync(process.execPath, [pm, ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    timeout: 180000,
  });

try {
  const listed = runPnpm(["list", "--depth", "Infinity", "--recursive", "--json"]);
  assert(!listed.error && listed.status === 0, "Could not inspect the installed dependency tree");
  const manifest = JSON.parse(readFileSync(join(root, "security-remediations.json"), "utf8"));
  const verified = verifyInstalledPatches(root, manifest, JSON.parse(listed.stdout));

  // Test real Expo-resolved libraries before treating a registry finding as locally remediated.
  const regression = spawnSync(process.execPath, ["--test", "tests/security/toolchain.test.mjs"], {
    cwd: root,
    encoding: "utf8",
    timeout: 60000,
  });
  process.stdout.write(regression.stdout ?? "");
  process.stderr.write(regression.stderr ?? "");
  assert(!regression.error && regression.status === 0, "Security regression tests failed");

  const audit = runPnpm(["audit", "--json", "--audit-level", "low"]);
  assert(!audit.error && [0, 1].includes(audit.status), "Registry audit execution failed");
  const raw = JSON.parse(audit.stdout);
  // Preserve the complete original scanner response, including all high findings.
  writeFileSync(evidence, `${JSON.stringify(raw, null, 2)}\n`);
  const assessment = assessAudit(raw, verified);
  for (const finding of assessment.findings) {
    console.log(
      `${finding.severity.toUpperCase()} ${finding.advisory} ${finding.package}: ${finding.state}`,
    );
  }
  for (const proof of verified.values()) {
    console.log(
      `Verified exact source/patch hashes for ${proof.package}@${proof.version}: ${proof.copies} installed copy/copies`,
    );
  }
  console.log(`Raw registry report retained at ${evidence}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      "## Dependency verification\n\n" +
        assessment.findings
          .map((finding) => `- ${finding.severity} ${finding.advisory}: ${finding.state}`)
          .join("\n") +
        "\n\nLocal patch proof includes installed-source hashes and executed regressions. Raw registry findings are retained; this is not a clean registry audit.\n",
      { flag: "a" },
    );
  }
  assert.equal(
    assessment.blockers.length,
    0,
    `Unremediated advisories (any severity): ${assessment.blockers.join(", ")}`,
  );
  console.log(
    "PASS: installed patch proofs and regressions; no unremediated findings at any severity in this audit.",
  );
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
