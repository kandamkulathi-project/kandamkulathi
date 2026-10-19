import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { root } from "./tools.mjs";

const run = (command, args, capture = false) => {
  let binary;
  switch (command) {
    case "git":
      binary = "git";
      break;
    case "python":
      binary = "python";
      break;
    case "node":
      binary = process.execPath;
      break;
    default:
      throw new Error("Unapproved pre-commit executable");
  }
  const result = spawnSync(binary, args, {
    cwd: root,
    stdio: capture ? "pipe" : "inherit",
    encoding: "utf8",
    timeout: 600000,
  });
  assert(!result.error && result.status === 0, `Pre-commit failed: ${binary} ${args.join(" ")}`);
  return result.stdout?.trim();
};

try {
  const branch = run("git", ["branch", "--show-current"], true);
  assert(
    branch && !["dev", "main"].includes(branch),
    "Commit on a feature branch; dev/main require reviewed PRs",
  );
  // Test the same tracked contents that will be committed; do not silently stash anyone's work.
  run("git", ["diff", "--quiet", "--exit-code"], true);
  assert.equal(
    run("git", ["ls-files", "--others", "--exclude-standard"], true),
    "",
    "Stage intended files or move unrelated untracked files before committing",
  );
  const candidate = run("git", ["write-tree"], true);
  const pin = readFileSync(join(root, ".node-version"), "utf8").trim();
  assert.equal(
    process.versions.node,
    pin,
    "Use the repository's exact Node version before committing",
  );
  // pnpm records its JS entry during installation; Git hooks do not inherit npm_execpath.
  const executable =
    process.env.npm_execpath ??
    JSON.parse(readFileSync(join(root, ".local-data/pnpm-entry.json"), "utf8"));
  const managerPin = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8"),
  ).packageManager.split("@")[1];
  assert.equal(
    run("node", [executable, "--version"], true),
    managerPin,
    "Use the exact pnpm version and rerun pnpm hooks:install",
  );
  for (const command of [
    "verify",
    "test:security:scanners",
    "security:sast",
    "security:secrets:staged",
    "security:runtime",
    "security:check",
    "mobile:check",
    "test:e2e",
  ]) {
    run("node", [executable, command]);
  }
  run("python", ["scripts/check_repository.py"]);
  run("python", ["-m", "unittest", "discover", "-s", "tests/repository", "-v"]);
  run("git", ["diff", "--check"]);
  run("git", ["diff", "--quiet", "--exit-code"], true);
  assert.equal(
    run("git", ["write-tree"], true),
    candidate,
    "Staged candidate changed during checks; rerun them",
  );
  assert.equal(
    run("git", ["branch", "--show-current"], true),
    branch,
    "Branch changed during checks",
  );
  console.log(
    "Pre-commit checks passed. Local hooks can be bypassed; server protections remain necessary.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
