import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  assertCandidateUnchanged,
  captureCandidate,
  prepareArtifact,
  privatePath,
  verifyArtifact,
} from "../../scripts/platform/release.mjs";

test("frozen release binds Worker bytes, inventory and schema; changes and path escape fail", () => {
  const root = resolve(".local-data", `artifact-test-${randomBytes(6).toString("hex")}`);
  mkdirSync(root, { recursive: true });
  const core = resolve(root, "core-input.js");
  const companion = resolve(root, "companion-input.js");
  writeFileSync(core, "export default {fetch(){return new Response('synthetic')}}");
  writeFileSync(companion, "export default {fetch(){return new Response('synthetic')}}");
  const manifest = JSON.parse(
    readFileSync(new URL("../../config/environments/dev.json", import.meta.url)),
  );
  const path = resolve(root, "release", "artifact.json");
  prepareArtifact({
    sourceSha: "a".repeat(40),
    manifest,
    output: path,
    bundles: { "core-api": core, companion },
  });
  assert.equal(verifyArtifact(path, manifest).apiVersion, 1);
  assert.throws(() => verifyArtifact(path, { ...manifest, namespace: "kandamkulathi-production" }));
  writeFileSync(resolve(root, "release", "core-api.js"), "modified");
  assert.throws(() => verifyArtifact(path, manifest));
  assert.throws(() => privatePath(".local-data/../../escaped.json"));
  assert.throws(() =>
    prepareArtifact({
      sourceSha: "a".repeat(40),
      manifest,
      output: path,
      bundles: { "core-api": core, companion },
    }),
  );
});

test("actual Git candidate rejects uncommitted inputs and a different clean revision after build", () => {
  const root = resolve(".local-data", `candidate-git-${randomBytes(6).toString("hex")}`);
  mkdirSync(root, { recursive: true });
  const hooks = resolve(root, "empty-hooks");
  mkdirSync(hooks);
  const env = { ...process.env };
  for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR"])
    delete env[key];
  const git = (args) => {
    const result = spawnSync(
      "git",
      [
        "-c",
        "commit.gpgsign=false",
        "-c",
        `core.hooksPath=${hooks}`,
        "-c",
        "user.name=Platform fixture",
        "-c",
        "user.email=platform-fixture@example.invalid",
        ...args,
      ],
      { cwd: root, env, encoding: "utf8", windowsHide: true },
    );
    assert.equal(result.status, 0, "Synthetic Git fixture operation failed");
  };
  git(["init"]);
  writeFileSync(resolve(root, "worker.js"), "export const revision=1;\n");
  git(["add", "worker.js"]);
  git(["commit", "-m", "Synthetic candidate one"]);
  const before = captureCandidate(root);
  assertCandidateUnchanged(before, root);
  writeFileSync(resolve(root, "worker.js"), "export const revision=2;\n");
  assert.throws(() => captureCandidate(root), /Commit verified inputs/);
  git(["add", "worker.js"]);
  git(["commit", "-m", "Synthetic candidate two"]);
  assert.throws(() => assertCandidateUnchanged(before, root), /candidate changed/);
  assert.notEqual(captureCandidate(root), before);
});
