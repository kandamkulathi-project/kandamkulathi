import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { sha256 } from "./policy.mjs";
import { cachedTool, root, tool } from "./tools.mjs";

export function executionEnvironment(command, cwd, source = process.env) {
  const env = { ...source, SEMGREP_SEND_METRICS: "off" };
  // Scanners discover their repository from cwd, never inherited Git hook selectors.
  // Root Git operations retain the actual candidate's alternate staged index.
  if (command !== "git" || resolve(cwd) !== resolve(root)) {
    for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR"])
      delete env[key];
  }
  return env;
}

export function execute(command, args, cwd, input) {
  // Only fixed Git or checksum-verified scanner executables may run; never a caller-supplied path.
  let binary;
  switch (command) {
    case "git":
      binary = "git";
      break;
    case "opengrep":
      binary = cachedTool("opengrep");
      break;
    case "gitleaks":
      binary = cachedTool("gitleaks");
      break;
    default:
      throw new Error("Unapproved executable");
  }
  const env = executionEnvironment(command, cwd);
  const result = spawnSync(binary, args, {
    cwd,
    input,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    timeout: 180000,
    env,
  });
  assert(!result.error && result.signal === null, "Scanner execution failed or timed out");
  return result;
}

export async function sast(targets = ["apps", "packages", "scripts", ".github"], cwd = root) {
  const vendor = join(root, ".security/sast/vendor");
  const manifest = JSON.parse(readFileSync(join(root, ".security/sast/vendor-manifest.json")));
  for (const [file, digest] of Object.entries(manifest.files)) {
    assert.equal(
      sha256(readFileSync(join(vendor, file))),
      digest,
      `Vendored rule changed: ${file}`,
    );
  }
  await tool("opengrep");
  const result = execute(
    "opengrep",
    [
      "scan",
      "--config",
      vendor,
      "--config",
      join(root, ".security/sast/project.yml"),
      "--error",
      "--strict",
      "--disable-nosem",
      "--disable-version-check",
      "--max-target-bytes=0",
      "--x-ignore-semgrepignore-files",
      "--json",
      ...targets,
    ],
    cwd,
  );
  assert([0, 1].includes(result.status), `SAST failed: ${result.stderr}`);
  const report = JSON.parse(result.stdout);
  assert(Array.isArray(report.results) && Array.isArray(report.errors), "Invalid SAST report");
  assert.equal(report.errors.length, 0, "SAST parsing/configuration errors require review");
  assert(report.paths?.scanned?.length > 0, "SAST scanned no files");
  return report;
}

export async function scanSecrets(cwd = root, history = true) {
  await tool("gitleaks");
  const local = join(cwd, ".local-data");
  mkdirSync(local, { recursive: true });
  const emptyIgnore = join(local, "empty-gitleaksignore");
  writeFileSync(emptyIgnore, "");
  const flags = [
    "--no-banner",
    "--redact=100",
    "--ignore-gitleaks-allow",
    "--gitleaks-ignore-path",
    emptyIgnore,
    "--config",
    join(root, ".security/gitleaks.toml"),
  ];
  if (history) {
    const result = execute("gitleaks", ["git", ...flags, "--log-opts=--all", "."], cwd);
    assert.equal(result.status, 0, `Git history secret scan failed (redacted): ${result.stderr}`);
  }
  const snapshot = mkdtempSync(join(local, "secret-index-"));
  try {
    // Scan the complete Git index, including forced tracked files in ignored paths.
    const exported = execute(
      "git",
      ["checkout-index", "--all", `--prefix=${snapshot.replaceAll("\\", "/")}/`],
      cwd,
    );
    assert.equal(exported.status, 0, "Could not export the staged files for secret scanning");
    const result = execute("gitleaks", ["dir", ...flags, snapshot], cwd);
    assert.equal(result.status, 0, `Staged secret scan failed (redacted): ${result.stderr}`);
  } finally {
    const within = relative(resolve(local), resolve(snapshot));
    assert(
      within && !within.startsWith("..") && !isAbsolute(within),
      "Unsafe snapshot cleanup path",
    );
    rmSync(snapshot, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv[2] === "sast") {
      const report = await sast();
      for (const finding of report.results) {
        console.error(`${finding.check_id}: ${finding.path}:${finding.start.line}`);
      }
      assert.equal(
        report.results.length,
        0,
        "SAST findings must be resolved before committing/merging",
      );
      console.log(`SAST passed; ${report.paths.scanned.length} source/workflow files scanned.`);
    } else {
      assert(["secrets", "staged"].includes(process.argv[2]), "Unknown scan command");
      await scanSecrets(root, process.argv[2] === "secrets");
      console.log("Secret scan passed (values redacted).");
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
