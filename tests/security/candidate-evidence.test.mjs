import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  artifactsSnapshot,
  inside,
  localInputs,
  requireCommitted,
  snapshot,
  sourceSnapshot,
  validateBinding,
} from "../../scripts/verification/evidence.mjs";
import { verifyLocal } from "../../scripts/verification/local.mjs";
import CandidateReporter from "../../scripts/verification/playwright.mjs";
import { verificationFixture } from "../helpers/verification.mjs";

async function fixture(run) {
  const value = verificationFixture();
  try {
    await run(value);
  } finally {
    value.cleanup();
  }
}
test("local verification rejects remote origins, live provider flags and server credentials", () =>
  fixture(({ folder }) => {
    assert.equal(localInputs(folder, {}).APP_ENV, "local");
    for (const env of [
      { VITE_CORE_API_ORIGIN: "https://api.example.com" },
      { EXPO_PUBLIC_APP_ENV: "production" },
      { ALLOW_LIVE_PAYMENTS: "true" },
      { OPENAI_API_KEY: "synthetic-not-a-key" },
      { VITE_UNREVIEWED: "synthetic" },
    ])
      assert.throws(() => localInputs(folder, env), /refused/);
  }));
test("ignored private dotenv/Worker overlays cannot escape the local configuration preflight", () =>
  fixture(({ folder }) => {
    writeFileSync(join(folder, ".env.example"), "EMPTY=\n");
    localInputs(folder, {});
    writeFileSync(join(folder, "apps/core-api/.dev.vars"), "SYNTHETIC=value\n");
    assert.throws(() => localInputs(folder, {}), /overlay refused/);
  }));

test("candidate fingerprints bind committed Git tree, index and actual bytes deterministically", () =>
  fixture(({ folder, runGit }) => {
    const before = sourceSnapshot(folder);
    requireCommitted(before);
    assert.deepEqual(sourceSnapshot(folder), before);
    writeFileSync(join(folder, "source.txt"), "changed source\n");
    const dirty = sourceSnapshot(folder);
    assert.notEqual(dirty.worktreeSha256, before.worktreeSha256);
    assert.throws(() => requireCommitted(dirty), /Commit/);
    runGit(["add", "source.txt"]);
    const staged = sourceSnapshot(folder);
    assert.notEqual(staged.indexTree, staged.tree);
    assert.throws(() => requireCommitted(staged), /Commit/);
  }));
test("untracked source and non-root snapshots cannot masquerade as the committed candidate", () =>
  fixture(({ folder }) => {
    const before = sourceSnapshot(folder);
    writeFileSync(join(folder, "untracked.txt"), "synthetic untracked\n");
    assert.notEqual(sourceSnapshot(folder).worktreeSha256, before.worktreeSha256);
    assert.throws(() => requireCommitted(sourceSnapshot(folder)), /Commit/);
    assert.throws(() => sourceSnapshot(join(folder, "apps")), /repository root/);
  }));
for (const [flag, tag] of [
  ["--assume-unchanged", "h"],
  ["--skip-worktree", "S"],
]) {
  for (const modified of [false, true]) {
    test(`${flag} refuses ${modified ? "modified" : "unchanged"} tracked source without clearing flags`, () =>
      fixture(({ folder, runGit }) => {
        runGit(["update-index", flag, "source.txt"]);
        if (modified) writeFileSync(join(folder, "source.txt"), "uncommitted synthetic source\n");
        const flags = runGit(["ls-files", "-v", "-z"]);
        const source = sourceSnapshot(folder);
        assert.equal(source.dirty, false); // Git's ordinary status cannot establish this boundary.
        assert.throws(() => requireCommitted(source), /masked/i);
        assert.deepEqual(source.maskedFiles, [{ path: "source.txt", tag }]);
        assert.throws(() => snapshot(folder), /masked/i);
        assert.equal(runGit(["ls-files", "-v", "-z"]), flags);
      }));
  }
}
test("combined masking flags retain the lowercase skip-worktree tag and spaced path", () =>
  fixture(({ folder, runGit }) => {
    writeFileSync(join(folder, "masked name.txt"), "synthetic source\n");
    runGit(["add", "masked name.txt"]);
    runGit(["commit", "--quiet", "-m", "Synthetic spaced path"]);
    for (const flag of ["--skip-worktree", "--assume-unchanged"])
      runGit(["update-index", flag, "masked name.txt"]);
    const source = sourceSnapshot(folder);
    assert.throws(() => requireCommitted(source), /masked/i);
    assert.deepEqual(source.maskedFiles, [{ path: "masked name.txt", tag: "s" }]);
  }));
test("legitimate CRLF checkout normalization remains a clean committed candidate", () =>
  fixture(({ folder, runGit }) => {
    writeFileSync(join(folder, ".gitattributes"), "source.txt text eol=crlf\n");
    writeFileSync(join(folder, "source.txt"), "synthetic source\r\n");
    runGit(["add", ".gitattributes", "source.txt"]);
    runGit(["commit", "--quiet", "-m", "Synthetic checkout normalization"]);
    const source = sourceSnapshot(folder);
    requireCommitted(source);
    assert.equal(source.dirty, false);
    assert.equal(readFileSync(join(folder, "source.txt"), "utf8"), "synthetic source\r\n");
  }));
test("all five artifact roots are required and every file is fingerprinted", () =>
  fixture(({ folder }) => {
    const before = artifactsSnapshot(folder);
    assert.equal(before.files.length, 5);
    writeFileSync(join(folder, "apps/mobile/dist/extra.hbc"), "synthetic bytecode");
    assert.notEqual(artifactsSnapshot(folder).sha256, before.sha256);
    const path = inside(folder, "apps/core-api/dist/artifact.txt");
    rmSync(path);
    assert.throws(() => artifactsSnapshot(folder), /empty/);
  }));
test("missing builds, path traversal and symlinked artifact roots fail closed", () =>
  fixture(({ folder }) => {
    assert.throws(() => inside(folder, "../outside"), /escapes/);
    assert.throws(() => inside(folder, folder), /relative/);
    const build = inside(folder, "apps/core-api/dist");
    rmSync(build, { recursive: true });
    assert.throws(() => artifactsSnapshot(folder));
    const target = inside(folder, "synthetic-build");
    mkdirSync(target);
    writeFileSync(join(target, "artifact.txt"), "synthetic data");
    symlinkSync(target, build, process.platform === "win32" ? "junction" : "dir");
    assert.throws(() => artifactsSnapshot(folder), /symlink/);
  }));
async function binding(folder) {
  const reporter = new CandidateReporter({ repositoryRoot: folder });
  reporter.onBegin({}, { allTests: () => [{}] });
  reporter.onTestEnd({}, { status: "passed" });
  await reporter.onEnd({ status: "passed" });
  return JSON.parse(readFileSync(join(folder, "test-results/p1-candidate-binding.json"), "utf8"));
}
test("passing browser evidence is local-only and never grants phase acceptance", () =>
  fixture(async ({ folder }) => {
    const result = await binding(folder);
    validateBinding(result, snapshot(folder), result.runId);
    assert.equal(result.scope, "local-only");
    assert.equal(result.phaseDecision, "not-issued");
    assert(!JSON.stringify(result).includes("synthetic source"));
  }));
test("missing, malformed or nonempty masking evidence cannot be forged into a committed binding", () =>
  fixture(async ({ folder }) => {
    const result = await binding(folder);
    for (const maskedFiles of [undefined, null, false, {}, "", ["source.txt"]]) {
      const source = { ...sourceSnapshot(folder), maskedFiles };
      assert.throws(() => requireCommitted(source), /masked/i);
      // Matching forged expected/before/after records must not bypass field validation.
      const expected = { ...snapshot(folder), source };
      const forged = { ...result, before: expected, after: expected };
      assert.throws(() => validateBinding(forged, expected, result.runId), /masked/i);
    }
    for (const side of ["before", "after"]) {
      const forged = structuredClone(result);
      delete forged[side].source.maskedFiles;
      assert.throws(() => validateBinding(forged, snapshot(folder), result.runId), /masked/i);
    }
  }));
for (const flag of ["none", "--assume-unchanged", "--skip-worktree"]) {
  test(`actual browser-free Playwright CLI reporter campaign ${flag}`, () =>
    fixture(({ folder, runGit }) => {
      const reporter = fileURLToPath(
        new URL("../../scripts/verification/playwright.mjs", import.meta.url),
      );
      writeFileSync(
        join(folder, "playwright.config.mjs"),
        `export default { testDir: '.', testMatch: 'probe.spec.mjs', outputDir: 'test-results/runner-output', workers: 1, retries: 0, reporter: [[${JSON.stringify(reporter)}, { repositoryRoot: ${JSON.stringify(folder)} }]] };`,
      );
      writeFileSync(
        join(folder, "probe.spec.mjs"),
        "import { test, expect } from '@playwright/test'; test('synthetic Node assertion; no browser', () => { expect(1 + 1).toBe(2); });\n",
      );
      const developmentConfig = fileURLToPath(
        new URL("../../playwright.dev.config.ts", import.meta.url),
      );
      writeFileSync(
        join(folder, "secondary.config.ts"),
        `import development from ${JSON.stringify(developmentConfig)}; export default { ...development, testDir: '.', testMatch: 'probe.spec.mjs', webServer: undefined, reporter: 'list' };`,
      );
      runGit(["add", "."]);
      runGit(["commit", "--quiet", "-m", "Synthetic Node reporter campaign"]);
      if (flag !== "none") {
        runGit(["update-index", flag, "source.txt"]);
        writeFileSync(join(folder, "source.txt"), "uncommitted synthetic source\n");
      }
      const flags = runGit(["ls-files", "-v", "-z"]);
      const result = spawnSync(
        process.execPath,
        [
          fileURLToPath(import.meta.resolve("@playwright/test/cli")),
          "test",
          "--config",
          join(folder, "playwright.config.mjs"),
        ],
        {
          cwd: folder,
          encoding: "utf8",
          timeout: 30000,
          maxBuffer: 1024 * 1024,
          env: { ...process.env, CI: "true" },
        },
      );
      assert.ifError(result.error);
      assert.equal(result.status, flag === "none" ? 0 : 1, result.stdout + result.stderr);
      const report = JSON.parse(
        readFileSync(join(folder, "test-results/p1-candidate-binding.json"), "utf8"),
      );
      assert.equal(report.testStatus, "passed");
      assert.equal(report.attempts.passed, 1);
      assert.equal(report.bindingStatus, flag === "none" ? "passed" : "failed");
      assert.equal(runGit(["ls-files", "-v", "-z"]), flags);
      if (flag === "none") {
        validateBinding(report, snapshot(folder), report.runId);
        const secondary = spawnSync(
          process.execPath,
          [
            fileURLToPath(import.meta.resolve("@playwright/test/cli")),
            "test",
            "--config",
            join(folder, "secondary.config.ts"),
          ],
          {
            cwd: folder,
            encoding: "utf8",
            timeout: 30000,
            maxBuffer: 1024 * 1024,
            env: { ...process.env, CI: "true" },
          },
        );
        assert.ifError(secondary.error);
        assert.equal(secondary.status, 0, secondary.stdout + secondary.stderr);
        const retained = JSON.parse(
          readFileSync(join(folder, "test-results/p1-candidate-binding.json"), "utf8"),
        );
        assert.deepEqual(retained, report);
        validateBinding(retained, snapshot(folder), report.runId);
      }
    }));
}
test("stale run IDs and a changed artifact set cannot reuse a passing browser result", () =>
  fixture(async ({ folder }) => {
    const result = await binding(folder);
    assert.throws(() => validateBinding(result, snapshot(folder), "different-run"), /Stale/);
    writeFileSync(join(folder, "apps/workspaces/dist/artifact.txt"), "changed build");
    assert.throws(() => validateBinding(result, snapshot(folder), result.runId), /candidate/);
  }));
test("failed, skipped, retried and zero-test browser evidence cannot become a local pass", () =>
  fixture(async ({ folder }) => {
    const result = await binding(folder);
    for (const extra of [
      { testStatus: "failed" },
      { plannedTests: 0 },
      { bindingStatus: "failed" },
      { attempts: { ...result.attempts, skipped: 1 } },
      { attempts: { ...result.attempts, failed: 1 } },
      { attempts: { ...result.attempts, passed: 2 } },
    ])
      assert.throws(() => validateBinding({ ...result, ...extra }, snapshot(folder), result.runId));
  }));
test("reporter overrides a passing test result if source changes during the run", () =>
  fixture(async ({ folder }) => {
    const reporter = new CandidateReporter({ repositoryRoot: folder });
    reporter.onBegin({}, { allTests: () => [{}] });
    writeFileSync(join(folder, "source.txt"), "changed during test");
    assert.deepEqual(await reporter.onEnd({ status: "passed" }), { status: "failed" });
    const result = JSON.parse(
      readFileSync(join(folder, "test-results/p1-candidate-binding.json"), "utf8"),
    );
    assert.equal(result.bindingStatus, "failed");
  }));
test("zero-test runs and unsupported command/approval overrides are rejected", () =>
  fixture(async ({ folder }) => {
    const reporter = new CandidateReporter({ repositoryRoot: folder });
    reporter.onBegin({}, { allTests: () => [] });
    assert.deepEqual(await reporter.onEnd({ status: "passed" }), { status: "failed" });
    for (const args of [["--approve"], ["--skip-security"], ["echo", "pass"]])
      assert.throws(() => verifyLocal(args), /No flags/);
  }));
test("reporter failure hint identifies masking flags without disclosing source", (context) =>
  fixture(async ({ folder, runGit }) => {
    const messages = [];
    context.mock.method(console, "error", (message) => messages.push(message));
    runGit(["update-index", "--assume-unchanged", "source.txt"]);
    const reporter = new CandidateReporter({ repositoryRoot: folder });
    reporter.onBegin({}, { allTests: () => [{}] });
    reporter.onTestEnd({}, { status: "passed" });
    assert.deepEqual(await reporter.onEnd({ status: "passed" }), { status: "failed" });
    assert.equal(messages.length, 1);
    assert.match(messages[0], /assume-unchanged/);
    assert.match(messages[0], /skip-worktree/);
    assert(!messages[0].includes("synthetic source"));
  }));
