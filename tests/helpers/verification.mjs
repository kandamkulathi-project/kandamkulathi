import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { artifactRoots, git, repository } from "../../scripts/verification/evidence.mjs";

export function verificationFixture() {
  const base = join(repository, ".local-data");
  mkdirSync(base, { recursive: true });
  const folder = mkdtempSync(join(base, "verification-fixture-"));
  const runGit = (args) => git(folder, args);
  runGit(["init", "--quiet"]);
  runGit(["config", "user.email", "synthetic@example.test"]);
  runGit(["config", "user.name", "Synthetic verification fixture"]);
  runGit(["config", "commit.gpgsign", "false"]);
  mkdirSync(join(folder, ".git/empty-hooks"));
  runGit(["config", "core.hooksPath", join(folder, ".git/empty-hooks")]);
  writeFileSync(join(folder, ".gitignore"), "dist/\ntest-results/\nprivate-evidence/\n");
  writeFileSync(join(folder, "source.txt"), "synthetic source\n");
  for (const path of artifactRoots) {
    mkdirSync(join(folder, path), { recursive: true });
    writeFileSync(join(folder, path, "artifact.txt"), "synthetic build\n");
  }
  runGit(["add", "."]);
  runGit(["commit", "--quiet", "-m", "Synthetic candidate"]);
  return {
    folder,
    runGit,
    cleanup() {
      const within = relative(base, folder);
      assert(within && !within.startsWith("..") && !isAbsolute(within), "Unsafe fixture cleanup");
      rmSync(folder, { recursive: true, force: true });
    },
  };
}
