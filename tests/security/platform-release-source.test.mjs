import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { assertCandidateUnchanged, captureCandidate } from "../../scripts/platform/release.mjs";
import { verificationFixture } from "../helpers/verification.mjs";

const release = fileURLToPath(new URL("../../scripts/platform/release.mjs", import.meta.url));
const manifest = fileURLToPath(new URL("../../config/environments/dev.json", import.meta.url));

for (const flag of ["--assume-unchanged", "--skip-worktree"]) {
  test(`release capture rejects ${flag} before and after builds without clearing it`, () => {
    const fixture = verificationFixture();
    try {
      const { folder, runGit } = fixture;
      const candidate = captureCandidate(folder);
      runGit(["update-index", flag, "source.txt"]);
      assert.throws(() => captureCandidate(folder), /Masked tracked files/);
      writeFileSync(join(folder, "source.txt"), "uncommitted Worker source\n");
      assert.equal(runGit(["status", "--porcelain"]), "");
      assert.equal(runGit(["write-tree"]), runGit(["rev-parse", "HEAD^{tree}"]));
      assert.throws(() => assertCandidateUnchanged(candidate, folder), /Masked tracked files/);
      assert.match(
        runGit(["ls-files", "-v", "source.txt"]),
        flag === "--skip-worktree" ? /^S / : /^h /,
      );
    } finally {
      fixture.cleanup();
    }
  });
}

test("release prepare CLI refuses hidden source before invoking either Worker builder", () => {
  const fixture = verificationFixture();
  try {
    const { folder, runGit } = fixture;
    writeFileSync(
      join(folder, ".node-version"),
      readFileSync(new URL("../../.node-version", import.meta.url)),
    );
    // Deterministic local builders exercise the CLI boundary, not Wrangler or cloud acceptance.
    for (const service of ["core-api", "companion"]) {
      const directory = join(folder, "apps", service, "node_modules/wrangler/bin");
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "wrangler.js"),
        `const fs = require('node:fs');
const path = require('node:path');
const out = process.argv[process.argv.indexOf('--outdir') + 1];
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.js'), 'export default {};');
fs.writeFileSync('.local-data/builder-ran', 'yes');\n`,
      );
    }
    mkdirSync(join(folder, ".local-data"));
    writeFileSync(
      join(folder, ".gitignore"),
      "dist/\ntest-results/\nprivate-evidence/\n.local-data/\n",
    );
    runGit(["add", "."]);
    runGit(["commit", "--quiet", "-m", "Synthetic release builders"]);
    const invoke = (name) =>
      spawnSync(
        process.execPath,
        [release, "prepare", manifest, `.local-data/${name}/artifact.json`],
        {
          cwd: folder,
          encoding: "utf8",
          timeout: 30000,
        },
      );
    const clean = invoke("clean");
    assert.equal(clean.status, 0, clean.stderr);
    assert.equal(JSON.parse(clean.stdout).status, "prepared");
    unlinkSync(join(folder, ".local-data/builder-ran"));
    for (const flag of ["--assume-unchanged", "--skip-worktree"]) {
      runGit(["update-index", flag, "source.txt"]);
      writeFileSync(join(folder, "source.txt"), `hidden ${flag}\n`);
      assert.equal(runGit(["status", "--porcelain"]), "");
      const result = invoke(flag.slice(2));
      assert.equal(result.status, 1);
      assert.match(result.stderr, /release rehearsal refused/);
      assert(!existsSync(join(folder, ".local-data/builder-ran")));
      assert(!existsSync(join(folder, ".local-data", flag.slice(2), "artifact.json")));
      runGit([
        "update-index",
        flag === "--skip-worktree" ? "--no-skip-worktree" : "--no-assume-unchanged",
        "source.txt",
      ]);
      writeFileSync(join(folder, "source.txt"), "synthetic source\n");
    }
  } finally {
    fixture.cleanup();
  }
});
