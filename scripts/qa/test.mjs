import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const files = readdirSync(new URL("../../tests/phase1/", import.meta.url))
  .filter((file) => /^[a-z][a-z0-9-]*\.test\.mjs$/.test(file))
  .sort()
  .map((file) => `tests/phase1/${file}`);
assert(files.length > 0, "Missing Phase 1 Node tests");
assert(
  process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === "--list"),
  "Usage: node scripts/qa/test.mjs [--list]",
);
if (process.argv[2] === "--list") console.log(JSON.stringify(files));
else {
  const result = spawnSync(process.execPath, ["--test", ...files], {
    cwd: root,
    stdio: "inherit",
    timeout: 120000,
  });
  process.exitCode = result.error || result.signal ? 1 : (result.status ?? 1);
}
