import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { describe, it } from "node:test";
import { execute, sast, scanSecrets } from "../../scripts/security/scan.mjs";
import { root } from "../../scripts/security/tools.mjs";

function fixture() {
  const folder = mkdtempSync(join(tmpdir(), "kandamkulathi-security-"));
  const cleanup = () => {
    const within = relative(resolve(tmpdir()), resolve(folder));
    assert(within && !within.startsWith("..") && !isAbsolute(within));
    rmSync(folder, { recursive: true, force: true });
  };
  return { folder, cleanup };
}

describe("real security scanner end-to-end negative controls", () => {
  it("detects JS execution, disabled TLS, raw SQL and Hono request-to-HTML flow", async () => {
    const { folder, cleanup } = fixture();
    try {
      writeFileSync(
        join(folder, "unsafe.ts"),
        [
          "export function unsafe(c) {",
          "eval(c.req.query('code')); // nosemgrep",
          "return c.html(c.req.query('html'));",
          "}",
          "export const options = { rejectUnauthorized: false };",
          "export function query(input) { return sql.raw('SELECT ' + input); }",
        ].join("\n"),
      );
      const report = await sast(["unsafe.ts"], folder);
      for (const rule of [
        "dynamic-code-execution",
        "disabled-tls-verification",
        "raw-sql-interpolation",
        "hono-request-to-dangerous-sink",
      ]) {
        assert(
          report.results.some((finding) => finding.check_id.endsWith(rule)),
          `Missing detection: ${rule}`,
        );
      }
      writeFileSync(join(folder, "safe.ts"), "export const amount: number = 100;\n");
      assert.equal((await sast(["safe.ts"], folder)).results.length, 0);
    } finally {
      cleanup();
    }
  });
  it("fails malformed source rather than claiming an empty successful scan", async () => {
    const { folder, cleanup } = fixture();
    try {
      writeFileSync(join(folder, "broken.ts"), "export function broken( { !!!");
      await assert.rejects(sast(["broken.ts"], folder), (error) => {
        assert.match(error.message, /SAST (failed|parsing\/configuration errors require review)/);
        assert(!error.message.includes("export function broken"), "Scanner error disclosed source");
        return true;
      });
    } finally {
      cleanup();
    }
  });
  it("scans authored source with inherited Git hook repository selectors", async () => {
    const keys = ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR"];
    const previous = keys.map((key) => [key, process.env[key]]);
    try {
      for (const key of keys) process.env[key] = join(root, ".local-data", `synthetic-${key}`);
      const report = await sast();
      assert.equal(report.results.length, 0);
      // Scanner paths use native separators on supported Windows workstations.
      const scanned = report.paths.scanned.map((path) => path.replaceAll("\\", "/"));
      assert(scanned.includes("packages/server/src/index.ts"));
      assert(
        scanned.every((path) => !/(^|\/)(node_modules|dist|\.wrangler|\.astro)\//.test(path)),
        "Generated artifacts must not replace the authored-source target set",
      );
    } finally {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
  it("detects React/Astro raw HTML and GitHub Actions expression injection", async () => {
    const { folder, cleanup } = fixture();
    try {
      writeFileSync(
        join(folder, "unsafe.tsx"),
        "export const View = ({ raw }) => <div dangerouslySetInnerHTML={{ __html: raw }} />;\n",
      );
      writeFileSync(
        join(folder, "unsafe.astro"),
        "---\nconst raw = Astro.url.searchParams.get('html');\n---\n<div set:html={raw}></div>\n",
      );
      const expression = ["$", "{{ github.event.pull_request.title }}"].join("");
      writeFileSync(
        join(folder, "unsafe.yml"),
        [
          "on: pull_request",
          "jobs:",
          "  unsafe:",
          "    runs-on: ubuntu-latest",
          "    steps:",
          `      - run: echo "${expression}"`,
        ].join("\n"),
      );
      const report = await sast(["unsafe.tsx", "unsafe.astro", "unsafe.yml"], folder);
      for (const filename of ["unsafe.tsx", "unsafe.astro", "unsafe.yml"]) {
        assert(
          report.results.some((finding) => finding.path.endsWith(filename)),
          `No detection for ${filename}`,
        );
      }
    } finally {
      cleanup();
    }
  });
  it("blocks staged secrets hidden by an ignored filename or inline allow comment", async () => {
    const { folder, cleanup } = fixture();
    try {
      assert.equal(execute("git", ["init"], folder).status, 0);
      writeFileSync(join(folder, ".gitignore"), ".env\n.local-data/\n");
      writeFileSync(join(folder, "safe.txt"), "Synthetic harmless configuration\n");
      assert.equal(execute("git", ["add", "."], folder).status, 0);
      await scanSecrets(folder, false);
      // Construct a deliberately fake credential at runtime; never commit its full value.
      const fake = "gh" + "p_" + "7Aq9Zb6Lr2Tc4Vs8Np3Dw5He1Mk0Jf6Yu9Rx";
      writeFileSync(join(folder, ".env"), `GITHUB_TOKEN=${fake} # gitleaks:allow\n`);
      assert.equal(execute("git", ["add", "--force", ".env"], folder).status, 0);
      // A clean-looking working file must not hide a secret already staged in Git.
      writeFileSync(join(folder, ".env"), "GITHUB_TOKEN=\n");
      await assert.rejects(scanSecrets(folder, false), (error) => {
        assert(!error.message.includes(fake), "Scanner failure disclosed a credential");
        return /Staged secret scan failed/.test(error.message);
      });
    } finally {
      cleanup();
    }
  });
  it("detects a secret in history even after its file is removed", async () => {
    const { folder, cleanup } = fixture();
    try {
      assert.equal(execute("git", ["init"], folder).status, 0);
      // Developer signing settings must not make synthetic fixture commits depend on a private key.
      assert.equal(execute("git", ["config", "commit.gpgsign", "true"], folder).status, 0);
      const fake = "gh" + "p_" + "7Aq9Zb6Lr2Tc4Vs8Np3Dw5He1Mk0Jf6Yu9Rx";
      writeFileSync(join(folder, "removed.txt"), `GITHUB_TOKEN=${fake}\n`);
      assert.equal(execute("git", ["add", "removed.txt"], folder).status, 0);
      const commit = [
        "-c",
        "user.name=Synthetic Security Test",
        "-c",
        "user.email=synthetic@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "Synthetic fixture",
      ];
      assert.equal(execute("git", commit, folder).status, 0);
      assert.equal(execute("git", ["rm", "removed.txt"], folder).status, 0);
      assert.equal(execute("git", commit, folder).status, 0);
      await assert.rejects(scanSecrets(folder, true), /Git history secret scan failed/);
    } finally {
      cleanup();
    }
  });
});
