import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import test from "node:test";
import { auditClientArtifacts } from "../../scripts/security/artifacts.mjs";
import { root } from "../../scripts/security/tools.mjs";

async function fixture(run) {
  const local = join(root, ".local-data");
  mkdirSync(local, { recursive: true });
  const folder = mkdtempSync(join(local, "artifact-control-"));
  try {
    await run(folder);
  } finally {
    const within = relative(local, folder);
    assert(within && !within.startsWith("..") && !isAbsolute(within));
    rmSync(folder, { recursive: true, force: true });
  }
}
test("artifact audit rejects absent outputs, source maps and backend fixture markers", async () => {
  await assert.rejects(auditClientArtifacts([".local-data/missing-client-build"]));
  await fixture(async (folder) => {
    writeFileSync(join(folder, "app.js.map"), "{}");
    await assert.rejects(auditClientArtifacts([folder]), /Private\/source-map/);
    rmSync(join(folder, "app.js.map"));
    writeFileSync(join(folder, "app.js"), 'const source = "Synthetic physician";');
    await assert.rejects(auditClientArtifacts([folder]), /marker/);
  });
});
test("actual Gitleaks scans printable Hermes strings and detects embedded credential-shaped literals", async () => {
  await fixture(async (folder) => {
    writeFileSync(
      join(folder, "app.hbc"),
      Buffer.concat([Buffer.from([0, 255, 0]), Buffer.from("safe client code")]),
    );
    assert.equal((await auditClientArtifacts([folder])).scanned, 1);
    const synthetic = ["AKIA", "ZXCVMNBVAQWERTYU"].join("");
    writeFileSync(
      join(folder, "app.hbc"),
      Buffer.concat([Buffer.from([0, 255, 0]), Buffer.from(`aws_access_key_id = "${synthetic}"`)]),
    );
    await assert.rejects(auditClientArtifacts([folder]), /secret scan failed/);
  });
});
