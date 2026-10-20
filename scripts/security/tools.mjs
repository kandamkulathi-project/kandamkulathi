import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { sha256 } from "./policy.mjs";

export const root = fileURLToPath(new URL("../../", import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, ".security/tools.json"), "utf8"));

export async function fetchBytes(url, transport = fetch, pause = delay) {
  assert.equal(new URL(url).protocol, "https:", "Security downloads require HTTPS");
  let failure;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response;
    try {
      response = await transport(url, { signal: AbortSignal.timeout(120000), cache: "no-store" });
    } catch (error) {
      failure = error;
    }
    if (response) {
      if (!response.ok) {
        // Retry temporary read failures only; authorization/not-found responses fail immediately.
        assert(
          response.status === 429 || response.status >= 500,
          `Security download rejected: HTTP ${response.status}`,
        );
        failure = new Error(`HTTP ${response.status}`);
      } else {
        try {
          return Buffer.from(await response.arrayBuffer());
        } catch (error) {
          failure = error;
        }
      }
    }
    if (attempt < 2) await pause((attempt + 1) * 1000);
  }
  throw new Error("Security download failed after three attempts", { cause: failure });
}

export function cachedTool(name) {
  const release = manifest[name];
  const artifact = release?.platforms[`${process.platform}-${process.arch}`];
  assert(artifact, "Unknown scanner or unsupported platform");
  const binary = join(
    root,
    ".local-data/security-tools",
    `${name}-${release.version}`,
    artifact.binary,
  );
  assert.equal(
    sha256(readFileSync(binary)),
    artifact.binarySha256,
    "Cached scanner checksum mismatch",
  );
  return binary;
}

export async function tool(name) {
  const release = manifest[name];
  assert(release, "Unknown scanner");
  const artifact = release.platforms[`${process.platform}-${process.arch}`];
  assert(artifact, "Scanner platform unsupported; use a supported Windows/Linux/macOS system");
  assert.match(artifact.sha256, /^[a-f0-9]{64}$/);
  assert.match(artifact.binarySha256, /^[a-f0-9]{64}$/);
  const location = join(root, ".local-data/security-tools", `${name}-${release.version}`);
  mkdirSync(location, { recursive: true });
  const binary = join(location, artifact.binary);
  if (!existsSync(binary)) {
    const url = new URL(artifact.url);
    assert.equal(url.origin, "https://github.com");
    const bytes = await fetchBytes(url);
    // Digest verification is outside retry handling: untrusted bytes must never be accepted.
    assert.equal(sha256(bytes), artifact.sha256, "Scanner download checksum mismatch");
    if (artifact.archive) {
      const archive = join(location, url.pathname.split("/").at(-1));
      writeFileSync(archive, bytes);
      const extracted = spawnSync("tar", ["-xf", archive, "-C", location], {
        stdio: "inherit",
        timeout: 60000,
      });
      assert(extracted.status === 0 && !extracted.error, "Scanner extraction failed");
    } else {
      writeFileSync(binary, bytes);
    }
    if (process.platform !== "win32") chmodSync(binary, 0o755);
  }
  // A cached executable must be checked before every use too.
  return cachedTool(name);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await tool("opengrep");
    await tool("gitleaks");
    console.log("Pinned, checksum-verified free scanners are ready.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
