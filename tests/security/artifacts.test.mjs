import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import test from "node:test";
import { auditClientArtifacts, clientRoots } from "../../scripts/security/artifacts.mjs";
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
test("each required client root independently needs scannable output", async () => {
  await fixture(async (folder) => {
    const targets = clientRoots.map((name) => join(folder, name));
    for (const target of targets) {
      mkdirSync(target, { recursive: true });
      writeFileSync(join(target, "app.js"), "export const synthetic = true;");
    }
    assert.equal((await auditClientArtifacts(targets)).scanned, clientRoots.length);
    for (const target of targets) {
      rmSync(join(target, "app.js"));
      await assert.rejects(auditClientArtifacts(targets), /No client artifacts scanned/);
      writeFileSync(join(target, "font.woff2"), Buffer.from([0, 255, 0]));
      await assert.rejects(auditClientArtifacts(targets), /No client artifacts scanned/);
      rmSync(join(target, "font.woff2"));
      writeFileSync(join(target, "app.js"), "export const synthetic = true;");
    }
  });
});
for (const extension of ["svg", "txt"]) {
  test(`artifact audit scans ${extension} markers and actual Gitleaks secret controls`, async () => {
    await fixture(async (folder) => {
      const path = join(folder, `asset.${extension}`);
      writeFileSync(
        path,
        extension === "svg" ? "<svg><text>Public label</text></svg>" : "Public label",
      );
      assert.equal((await auditClientArtifacts([folder])).scanned, 1);
      writeFileSync(path, "Synthetic physician");
      await assert.rejects(auditClientArtifacts([folder]), /marker/);
      const synthetic = ["AKIA", "ZXCVMNBVAQWERTYU"].join("");
      writeFileSync(path, `aws_access_key_id = "${synthetic}"`);
      await assert.rejects(auditClientArtifacts([folder]), /secret scan failed/);
      truncateSync(path, 32 * 1024 * 1024 + 1);
      await assert.rejects(auditClientArtifacts([folder]), /bounded audit size/);
    });
  });
}
test("binary fonts remain excluded while symlinked artifacts are refused", async () => {
  await fixture(async (folder) => {
    writeFileSync(join(folder, "app.js"), "export const synthetic = true;");
    writeFileSync(join(folder, "font.woff2"), "Synthetic physician");
    assert.equal((await auditClientArtifacts([folder])).scanned, 1);
    const linked = join(folder, "linked");
    await fixture(async (outside) => {
      writeFileSync(join(outside, "app.js"), "export const synthetic = true;");
      symlinkSync(outside, linked, process.platform === "win32" ? "junction" : "dir");
      await assert.rejects(auditClientArtifacts([linked]), /symlink/);
      await assert.rejects(auditClientArtifacts([folder]), /symlink/);
    });
  });
});
