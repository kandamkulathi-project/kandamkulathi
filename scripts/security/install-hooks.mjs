import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { root } from "./tools.mjs";

if (process.env.CI !== "true" && process.env.GITHUB_ACTIONS !== "true") {
  const git = (args) => spawnSync("git", args, { cwd: root, encoding: "utf8" });
  const top = git(["rev-parse", "--show-toplevel"]);
  assert.equal(top.status, 0, "Hook installation needs a Git checkout");
  assert.equal(resolve(top.stdout.trim()), resolve(root), "Unexpected Git root");
  const existing = git(["config", "--get", "core.hooksPath"]);
  assert([0, 1].includes(existing.status), "Cannot read Git hook configuration");
  if (existing.status === 0) {
    assert.equal(
      existing.stdout.trim(),
      ".githooks",
      "Existing custom hooks need deliberate integration; not overwritten",
    );
  } else {
    const location = git(["rev-parse", "--git-path", "hooks"]);
    assert.equal(location.status, 0);
    const hooks = resolve(root, location.stdout.trim());
    assert(
      !existsSync(hooks) || readdirSync(hooks).every((file) => file.endsWith(".sample")),
      "Existing active hooks need deliberate integration; not overwritten",
    );
  }
  if (process.platform !== "win32") chmodSync(join(root, ".githooks/pre-commit"), 0o755);
  assert(process.env.npm_execpath, "Install hooks with pnpm hooks:install or pnpm install");
  mkdirSync(join(root, ".local-data"), { recursive: true });
  writeFileSync(
    join(root, ".local-data/pnpm-entry.json"),
    JSON.stringify(process.env.npm_execpath),
  );
  assert.equal(git(["config", "--local", "core.hooksPath", ".githooks"]).status, 0);
  console.log("Local pre-commit checks installed. First scan downloads checksum-pinned tools.");
}
