import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import {
  assessAudit,
  fingerprintAdvisory,
  sha256,
  verifyInstalledPatches,
} from "../../scripts/security/policy.mjs";

const root = realpathSync(mkdtempSync(join(tmpdir(), "dependency-policy-")));
after(() => rmSync(root, { recursive: true, force: true }));
const pkgPath = join(root, "node_modules", ".pnpm", "example", "node_modules", "example");
const entry = {
  advisory: "GHSA-test",
  package: "example",
  version: "1.0.0",
  patch: "patches/example.patch",
  patchSha256: sha256("fixed patch"),
  files: { "lib/verify.js": sha256("fixed source") },
};
const manifest = { schemaVersion: 1, remediations: [entry] };
const tree = [{ dependencies: { example: { from: "example", path: pkgPath } } }];
const files = new Map([
  [join(root, entry.patch), "fixed patch"],
  [join(pkgPath, "package.json"), JSON.stringify({ name: "example", version: "1.0.0" })],
  [join(pkgPath, "lib/verify.js"), "fixed source"],
]);
for (const [path, content] of files) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}
const read = (path) => {
  assert(files.has(path), "Unexpected read");
  return files.get(path);
};
const advisory = {
  github_advisory_id: "GHSA-test",
  module_name: "example",
  severity: "high",
  title: "Test issue",
  findings: [{ version: "1.0.0" }],
};
entry.advisorySha256 = fingerprintAdvisory(advisory);
const report = (item = advisory) => ({
  advisories: { 1: item },
  muted: {},
  metadata: { vulnerabilities: { high: 1 } },
});

describe("security proof negative controls", () => {
  it("requires installed patch and source hashes before matching an advisory", () => {
    const verified = verifyInstalledPatches(root, manifest, tree, read);
    assert.equal(assessAudit(report(), verified).findings[0].state, "VERIFIED_LOCAL_PATCH");
  });
  it("fails if the installed source is unpatched or tampered", () => {
    assert.throws(
      () =>
        verifyInstalledPatches(root, manifest, tree, (path) =>
          path.endsWith("verify.js") ? "original vulnerable source" : read(path),
        ),
      /Unpatched/,
    );
  });
  it("fails if the patch file changes", () => {
    assert.throws(
      () =>
        verifyInstalledPatches(root, manifest, tree, (path) =>
          path.endsWith(".patch") ? "modified patch" : read(path),
        ),
      /Patch content/,
    );
  });
  it("fails missing installed instances and missing source evidence", () => {
    assert.throws(() => verifyInstalledPatches(root, manifest, [{}], read), /No installed copies/);
    assert.throws(
      () =>
        verifyInstalledPatches(
          root,
          { ...manifest, remediations: [{ ...entry, files: {} }] },
          tree,
          read,
        ),
      /fingerprints/,
    );
  });
  it("does not permit an additional unpatched copy", () => {
    const other = join(root, "node_modules", "other");
    mkdirSync(other);
    writeFileSync(
      join(other, "package.json"),
      JSON.stringify({ name: "example", version: "1.0.0" }),
    );
    const extra = [{ dependencies: { example: { from: "example", path: other } } }, ...tree];
    assert.throws(() => verifyInstalledPatches(root, manifest, extra, read), /Unexpected read/);
  });
  it("does not treat a known advisory ID alone as remediation", () => {
    assert.equal(assessAudit(report(), new Map()).blockers.length, 1);
  });
  it("distinguishes uninstalled optional binaries from unreadable installed packages", () => {
    const absent = join(root, "node_modules", "other-os-binary");
    const extra = [
      { optionalDependencies: { binary: { from: "other-os-binary", path: absent } } },
      ...tree,
    ];
    const optionalRead = (path) => {
      if (path.startsWith(absent))
        throw Object.assign(new Error("Not installed"), { code: "ENOENT" });
      return read(path);
    };
    assert.equal(verifyInstalledPatches(root, manifest, extra, optionalRead).size, 1);
    const installed = join(root, "node_modules", "unreadable");
    mkdirSync(installed);
    const unreadable = [
      { dependencies: { bad: { from: "unreadable", path: installed } } },
      ...tree,
    ];
    assert.throws(() => verifyInstalledPatches(root, manifest, unreadable, read), /ENOENT/);
  });
  it("also inspects aliased packages using their real installed identity", () => {
    const aliasPath = join(root, "node_modules", "alias");
    mkdirSync(aliasPath);
    mkdirSync(join(aliasPath, "lib"));
    writeFileSync(
      join(aliasPath, "package.json"),
      JSON.stringify({ name: "example", version: "1.0.0" }),
    );
    writeFileSync(join(aliasPath, "lib/verify.js"), "unpatched alias source");
    const extraTree = [
      { dependencies: { alias: { from: "npm:example@1.0.0", path: aliasPath } } },
      ...tree,
    ];
    const aliasRead = (path) =>
      path.startsWith(aliasPath)
        ? path.endsWith("package.json")
          ? JSON.stringify({ name: "example", version: "1.0.0" })
          : "unpatched alias source"
        : read(path);
    assert.throws(() => verifyInstalledPatches(root, manifest, extraTree, aliasRead), /Unpatched/);
  });
  it("fails a new advisory, changed module identity, or new vulnerable version", () => {
    const proof = new Map([[entry.advisory, entry]]);
    for (const changed of [
      { github_advisory_id: "GHSA-new" },
      { module_name: "other" },
      { findings: [{ version: "2.0.0" }] },
      { overview: "Changed vulnerability scope" },
    ]) {
      assert.equal(assessAudit(report({ ...advisory, ...changed }), proof).blockers.length, 1);
    }
  });
  it("rejects invalid or muted scanner reports", () => {
    assert.throws(() => assessAudit({}, new Map()), /valid vulnerability/);
    assert.throws(
      () => assessAudit({ ...report(), muted: { "GHSA-test": true } }, new Map()),
      /Muted/,
    );
  });
  it("fails unknown severity and treats unverified critical findings as blocking", () => {
    assert.throws(
      () => assessAudit(report({ ...advisory, severity: "unknown" }), new Map()),
      /Unknown/,
    );
    assert.equal(
      assessAudit(report({ ...advisory, severity: "critical" }), new Map()).blockers.length,
      1,
    );
  });
  it("blocks unremediated findings at every known severity", () => {
    for (const severity of ["info", "low", "moderate", "high", "critical"]) {
      assert.equal(assessAudit(report({ ...advisory, severity }), new Map()).blockers.length, 1);
    }
  });
  it("rejects positive vulnerability counts with missing advisory details", () => {
    assert.throws(
      () => assessAudit({ ...report(), advisories: {} }, new Map()),
      /omitted advisory/,
    );
    assert.throws(
      () => assessAudit({ ...report(), metadata: { vulnerabilities: { high: -1 } } }, new Map()),
      /Invalid vulnerability counts/,
    );
  });
});
