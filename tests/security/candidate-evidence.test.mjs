import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
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
