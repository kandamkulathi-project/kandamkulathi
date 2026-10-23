import assert from "node:assert/strict";
import { join } from "node:path";
import { it } from "node:test";
import { executionEnvironment } from "../../scripts/security/scan.mjs";
import { root } from "../../scripts/security/tools.mjs";

const selectors = ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR"];
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
