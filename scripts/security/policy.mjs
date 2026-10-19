import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const fingerprintAdvisory = (advisory) =>
  sha256(
    JSON.stringify({
      id: advisory.github_advisory_id,
      package: advisory.module_name,
      severity: advisory.severity,
      vulnerable: advisory.vulnerable_versions,
      patched: advisory.patched_versions,
      cves: advisory.cves,
      overview: advisory.overview,
      updated: advisory.updated,
    }),
  );

export function collectPackages(tree, names) {
  assert(Array.isArray(tree) && tree.length > 0, "Installed dependency tree is missing");
  const found = new Map();
  const walk = (value) => {
    if (!value || typeof value !== "object") return;
    if (names.includes(value.from) && value.path) found.set(value.path, value);
    for (const field of ["dependencies", "devDependencies", "optionalDependencies"]) {
      for (const dependency of Object.values(value[field] ?? {})) walk(dependency);
    }
  };
  for (const project of tree) walk(project);
  return [...found.values()];
}

export function verifyInstalledPatches(root, manifest, tree, read = readFileSync) {
  assert.equal(manifest.schemaVersion, 1, "Unknown remediation manifest format");
  assert(
    Array.isArray(manifest.remediations) && manifest.remediations.length > 0,
    "Remediation manifest must not be empty",
  );
  const installed = collectPackages(
    tree,
    manifest.remediations.map((entry) => entry.package),
  );
  const verified = new Map();
  const inside = (base, target) => {
    const difference = relative(resolve(base), resolve(target));
    return difference !== "" && !difference.startsWith("..") && !isAbsolute(difference);
  };
  for (const entry of manifest.remediations) {
    assert(!verified.has(entry.advisory), "Duplicate remediation ID");
    assert.match(entry.patchSha256, /^[a-f0-9]{64}$/);
    assert(inside(root, join(root, entry.patch)), "Patch must remain in the repository");
    assert.equal(sha256(read(join(root, entry.patch))), entry.patchSha256, "Patch content changed");
    const copies = installed.filter((item) => item.from === entry.package);
    assert(copies.length > 0, `No installed copies found for ${entry.package}`);
    for (const copy of copies) {
      assert(inside(join(root, "node_modules"), copy.path), "Unexpected dependency location");
      const pkg = JSON.parse(read(join(copy.path, "package.json"), "utf8"));
      assert.equal(pkg.name, entry.package, "Dependency identity differs");
      assert.equal(pkg.version, entry.version, "Unverified dependency version");
      for (const [file, expected] of Object.entries(entry.files)) {
        assert(inside(copy.path, join(copy.path, file)), "Source must remain in its package");
        assert.match(expected, /^[a-f0-9]{64}$/);
        assert.equal(
          sha256(read(join(copy.path, file))),
          expected,
          `Unpatched/changed ${entry.package}/${file}`,
        );
      }
      assert(Object.keys(entry.files).length > 0, "Source fingerprints are required");
    }
    verified.set(entry.advisory, { ...entry, copies: copies.length });
  }
  return verified;
}

export function assessAudit(report, verified) {
  assert(
    report && !report.error && report.advisories && report.metadata?.vulnerabilities,
    "Registry audit did not return a valid vulnerability report",
  );
  assert.equal(
    Object.keys(report.muted ?? {}).length,
    0,
    "Muted registry advisories are forbidden",
  );
  const findings = [];
  const blockers = [];
  for (const advisory of Object.values(report.advisories)) {
    assert(
      ["info", "low", "moderate", "high", "critical"].includes(advisory.severity),
      "Unknown advisory severity",
    );
    const proof = verified.get(advisory.github_advisory_id);
    const matches =
      proof &&
      proof.advisorySha256 === fingerprintAdvisory(advisory) &&
      proof.package === advisory.module_name &&
      Array.isArray(advisory.findings) &&
      advisory.findings.length > 0 &&
      advisory.findings.every((finding) => finding.version === proof.version);
    // This does not accept an ID exclusion: proof requires exact installed sources first.
    const state = matches ? "VERIFIED_LOCAL_PATCH" : "UNREMEDIATED";
    findings.push({
      advisory: advisory.github_advisory_id ?? advisory.url,
      package: advisory.module_name,
      severity: advisory.severity,
      state,
    });
    if (["high", "critical"].includes(advisory.severity) && !matches) blockers.push(advisory.title);
  }
  return { findings, blockers };
}
