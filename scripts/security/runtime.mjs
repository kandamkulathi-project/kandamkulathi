import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import semver from "semver";
import { fetchBytes, root } from "./tools.mjs";

export const sources = {
  advisories: "https://raw.githubusercontent.com/nodejs/security-wg/main/vuln/core/index.json",
  releases: "https://nodejs.org/dist/index.json",
  schedule: "https://raw.githubusercontent.com/nodejs/Release/main/schedule.json",
};

export function assessRuntime(version, data, now = new Date()) {
  assert(semver.valid(version), "Invalid pinned Node version");
  assert(Array.isArray(data.releases) && data.releases.length > 0, "Missing Node releases");
  assert(data.advisories && Object.keys(data.advisories).length > 0, "Missing Node advisories");
  const major = semver.major(version);
  const support = data.schedule?.[`v${major}`];
  assert(support && Number.isFinite(Date.parse(support.end)), "Invalid Node support schedule");
  assert(now < new Date(support.end), "Pinned Node release line is end-of-life");
  assert(
    data.releases.some((release) => release.version === `v${version}`),
    "Unpublished Node pin",
  );
  const blockers = [];
  for (const [id, advisory] of Object.entries(data.advisories)) {
    assert(
      semver.validRange(advisory.vulnerable),
      `Invalid vulnerable range in Node advisory ${id}`,
    );
    assert(semver.validRange(advisory.patched), `Invalid patched range in Node advisory ${id}`);
    if (
      semver.satisfies(version, advisory.vulnerable) &&
      !semver.satisfies(version, advisory.patched)
    ) {
      blockers.push({ id, cve: advisory.cve, ref: advisory.ref });
    }
  }
  for (const release of data.releases) {
    assert(semver.valid(release.version), "Invalid version in Node release feed");
    if (
      semver.major(release.version) === major &&
      release.security &&
      semver.gt(release.version, version)
    ) {
      blockers.push({ id: `newer-security-release-${release.version}` });
    }
  }
  return blockers;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const pin = readFileSync(join(root, ".node-version"), "utf8").trim();
    assert.equal(readFileSync(join(root, ".nvmrc"), "utf8").trim(), pin, "Node pins disagree");
    assert.equal(process.versions.node, pin, "Use the repository's exact Node version");
    const data = Object.fromEntries(
      await Promise.all(
        Object.entries(sources).map(async ([key, url]) => {
          return [key, JSON.parse(await fetchBytes(url))];
        }),
      ),
    );
    const blockers = assessRuntime(pin, data);
    mkdirSync(join(root, "test-results"), { recursive: true });
    writeFileSync(
      join(root, "test-results/node-security.json"),
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          node: pin,
          sources,
          blockers,
        },
        null,
        2,
      ),
    );
    assert.equal(
      blockers.length,
      0,
      `Node security blockers: ${blockers.map((item) => item.id).join(", ")}`,
    );
    console.log(`Node ${pin}: supported; no unpatched findings in current official feeds.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
