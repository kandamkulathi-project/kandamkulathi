import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { it } from "node:test";
import { execute, executionEnvironment } from "../../scripts/security/scan.mjs";
import { root } from "../../scripts/security/tools.mjs";

const selectors = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_COMMON_DIR",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
];
const inherited = Object.fromEntries(selectors.map((key) => [key, `synthetic-${key}`]));

it("external scanners discover their own cwd repository even in a Git hook", () => {
  for (const command of ["opengrep", "gitleaks"]) {
    const env = executionEnvironment(command, root, { ...inherited, PATH: "synthetic-path" });
    for (const key of selectors) assert.equal(env[key], undefined);
    assert.equal(env.PATH, "synthetic-path");
    assert.equal(env.SEMGREP_SEND_METRICS, "off");
  }
  for (const key of selectors) assert(inherited[key]);
});

it("Git in the candidate repository preserves its alternate staged index", () => {
  const env = executionEnvironment("git", root, inherited);
  for (const key of selectors) assert.equal(env[key], inherited[key]);
});

it("Git in synthetic repositories cannot inherit the candidate's index or worktree", () => {
  const env = executionEnvironment("git", join(root, ".local-data", "synthetic"), inherited);
  for (const key of selectors) assert.equal(env[key], undefined);
});
it("actual foreign Git object writes ignore inherited object-directory selectors", () => {
  const local = join(root, ".local-data");
  mkdirSync(local, { recursive: true });
  const folder = mkdtempSync(join(local, "git-object-control-"));
  const keys = ["GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES"];
  const previous = keys.map((key) => [key, process.env[key]]);
  try {
    for (const key of keys) process.env[key] = join(folder, `missing-${key}`);
    assert.equal(execute("git", ["init"], folder).status, 0);
    const content = "Synthetic foreign repository object\n";
    const written = execute("git", ["hash-object", "-w", "--stdin"], folder, content);
    assert.equal(written.status, 0);
    const read = execute("git", ["cat-file", "-p", written.stdout.trim()], folder);
    assert.equal(read.status, 0);
    assert.equal(read.stdout, content);
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    const within = relative(local, folder);
    assert(within && !within.startsWith("..") && !isAbsolute(within));
    rmSync(folder, { recursive: true, force: true });
  }
});
