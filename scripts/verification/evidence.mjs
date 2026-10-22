import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repository = fileURLToPath(new URL("../../", import.meta.url));
export const artifactRoots = [
  "apps/web-public/dist",
  "apps/workspaces/dist",
  "apps/mobile/dist",
  "apps/core-api/dist",
  "apps/companion/dist",
];
export const digest = (value) => createHash("sha256").update(value).digest("hex");

/** Fixed Git executable, no shell, and no inherited outer repository/index in synthetic tests. */
export function git(root, args) {
  const env = { ...process.env };
  for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR"])
    delete env[key];
  const result = spawnSync("git", args, {
    cwd: root,
    env,
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 8 * 1024 * 1024,
  });
  assert(!result.error && result.status === 0, "Candidate Git inspection failed");
  return result.stdout.trimEnd();
}

export function inside(root, name) {
  assert(name && !isAbsolute(name), "Evidence path must be relative");
  const path = resolve(root, name);
  const within = relative(root, path);
  assert(
    within && !within.startsWith("..") && !isAbsolute(within),
    "Evidence path escapes its root",
  );
  let current = root;
  for (const segment of within.split(/[\\/]/)) {
    current = join(current, segment);
    if (existsSync(current))
      assert(!lstatSync(current).isSymbolicLink(), "Evidence symlink refused");
  }
  return path;
}

function record(root, name) {
  const path = inside(root, name);
  const stat = lstatSync(path);
  assert(stat.isFile() && stat.size <= 64 * 1024 * 1024, "Unbounded/non-file candidate input");
  return {
    path: relative(root, path).replaceAll("\\", "/"),
    bytes: stat.size,
    sha256: digest(readFileSync(path)),
  };
}

export function sourceSnapshot(root = repository) {
  assert.equal(
    realpathSync(git(root, ["rev-parse", "--show-toplevel"])),
    realpathSync(root),
    "Expected repository root",
  );
  const names = [
    ...new Set(
      git(root, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"])
        .split("\0")
        .filter(Boolean),
    ),
  ].sort();
  const files = names.map((name) => record(root, name));
  return {
    head: git(root, ["rev-parse", "HEAD"]),
    tree: git(root, ["rev-parse", "HEAD^{tree}"]),
    indexTree: git(root, ["write-tree"]),
    branch: git(root, ["branch", "--show-current"]),
    dirty: git(root, ["status", "--porcelain", "--untracked-files=all"]) !== "",
    worktreeSha256: digest(JSON.stringify(files)),
    files,
  };
}

export function requireCommitted(source) {
  assert(
    !source.dirty && source.tree === source.indexTree,
    "Commit all intended work before recording a candidate",
  );
}

/** The local campaign must not silently load a company's private/provider environment. */
export function localInputs(root = repository, env = process.env) {
  const approved = {
    VITE_CORE_API_ORIGIN: "http://127.0.0.1:8787",
    VITE_COMPANION_API_ORIGIN: "http://127.0.0.1:8788",
    EXPO_PUBLIC_APP_ENV: "local",
    EXPO_PUBLIC_CORE_API_ORIGIN: "http://127.0.0.1:8787",
    EXPO_PUBLIC_COMPANION_API_ORIGIN: "http://127.0.0.1:8788",
    APP_ENV: "local",
    PROVIDER_MODE: "stub",
    ALLOW_LIVE_SENDS: "false",
    ALLOW_LIVE_PAYMENTS: "false",
  };
  for (const [key, value] of Object.entries(approved))
    assert(
      env[key] === undefined || env[key] === value,
      "Nonlocal verification configuration refused",
    );
  for (const key of Object.keys(env)) {
    if (key.startsWith("VITE_") || key.startsWith("EXPO_PUBLIC_"))
      assert(Object.hasOwn(approved, key), "Unapproved public configuration refused");
  }
  for (const key of [
    "DATABASE_URL",
    "DATABASE_ADMIN_URL",
    "WORKOS_API_KEY",
    "WORKOS_COOKIE_PASSWORD",
    "OPENAI_API_KEY",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "SHIPROCKET_TOKEN",
    "WHATSAPP_ACCESS_TOKEN",
    "SMS_API_KEY",
    "EMAIL_API_KEY",
    "TURN_CREDENTIAL_SECRET",
  ])
    assert(!env[key], "Server/provider credentials refused for local verification");
  for (const name of [
    ".",
    "apps/web-public",
    "apps/workspaces",
    "apps/mobile",
    "apps/core-api",
    "apps/companion",
  ]) {
    for (const file of readdirSync(name === "." ? root : inside(root, name)))
      assert(
        !/^\.(env|dev\.vars)($|\.)/.test(file) || /\.example$/.test(file),
        "Private environment overlay refused for local verification",
      );
  }
  return approved;
}

export function artifactsSnapshot(root = repository) {
  const files = [];
  const visit = (name) => {
    const path = inside(root, name);
    const stat = lstatSync(path);
    assert(files.length < 10000, "Unbounded artifact inventory");
    if (stat.isDirectory()) for (const child of readdirSync(path).sort()) visit(`${name}/${child}`);
    else files.push(record(root, name));
  };
  for (const directory of artifactRoots) {
    const before = files.length;
    visit(directory);
    assert(files.length > before, "Required build artifact root is empty");
  }
  files.sort((a, b) => a.path.localeCompare(b.path, "en"));
  return { sha256: digest(JSON.stringify(files)), files };
}

export function snapshot(root = repository) {
  const source = sourceSnapshot(root);
  const { files, ...identity } = source;
  const artifacts = artifactsSnapshot(root);
  return {
    source: identity,
    artifacts: { sha256: artifacts.sha256, count: artifacts.files.length },
  };
}

export function validateBinding(binding, expected, runId) {
  assert.equal(binding?.format, 1, "Unknown browser evidence format");
  assert.equal(binding.runId, runId, "Stale browser evidence/run ID");
  assert.equal(binding.bindingStatus, "passed", "Browser candidate binding failed");
  assert.equal(binding.testStatus, "passed", "Browser tests did not pass");
  assert(
    Number.isSafeInteger(binding.plannedTests) && binding.plannedTests > 0,
    "No browser tests executed",
  );
  assert.equal(
    binding.attempts.passed,
    binding.plannedTests,
    "Incomplete/retried browser campaign",
  );
  for (const [status, count] of Object.entries(binding.attempts))
    assert(status === "passed" || count === 0, "Failed/skipped browser attempts require triage");
  assert.deepEqual(binding.before, expected, "Browser start differs from final candidate");
  assert.deepEqual(binding.after, expected, "Browser end differs from final candidate");
}
