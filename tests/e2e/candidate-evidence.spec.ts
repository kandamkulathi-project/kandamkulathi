import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { verificationFixture } from "../helpers/verification.mjs";

for (const change of ["none", "artifact", "source"] as const) {
  test(`actual browser reporter ${change === "none" ? "records parity" : `rejects ${change} drift`}`, async ({
    browserName,
  }, testInfo) => {
    test.setTimeout(60000);
    const fixture = verificationFixture();
    try {
      mkdirSync(testInfo.outputDir, { recursive: true });
      const parentSentinel = testInfo.outputPath("parent-trace-sentinel.txt");
      writeFileSync(parentSentinel, "parent artifacts must survive the child run");
      const childOutput = join(fixture.folder, "test-results/runner-output");
      const reporter = fileURLToPath(
        new URL("../../scripts/verification/playwright.mjs", import.meta.url),
      );
      writeFileSync(
        join(fixture.folder, "playwright.config.mjs"),
        `export default { testDir: '.', testMatch: 'probe.spec.mjs', outputDir: ${JSON.stringify(childOutput)}, use: { browserName: ${JSON.stringify(browserName)} }, workers: 1, retries: 0, reporter: [['${reporter.replaceAll("\\", "/")}', { repositoryRoot: ${JSON.stringify(fixture.folder)} }]] };`,
      );
      writeFileSync(
        join(fixture.folder, "probe.spec.mjs"),
        `
        import { test, expect } from '@playwright/test';
        import { writeFileSync } from 'node:fs';
        test('synthetic browser proof', async ({ page }) => {
          expect(test.info().project.outputDir).toBe(${JSON.stringify(childOutput)});
          await page.setContent('<p>Synthetic isolated fixture</p>');
          await expect(page.getByText('Synthetic isolated fixture')).toBeVisible();
          ${change === "none" ? "" : `writeFileSync(${JSON.stringify(join(fixture.folder, change === "artifact" ? "apps/workspaces/dist/artifact.txt" : "source.txt"))}, 'synthetic drift');`}
        });
      `,
      );
      fixture.runGit(["add", "."]);
      fixture.runGit(["commit", "--quiet", "-m", "Synthetic browser candidate"]);
      const result = await new Promise<number | null>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [
            fileURLToPath(import.meta.resolve("@playwright/test/cli")),
            "test",
            "--config",
            join(fixture.folder, "playwright.config.mjs"),
            "--output",
            childOutput,
          ],
          {
            cwd: fixture.folder,
            stdio: "ignore",
            timeout: 45000,
            env: { ...process.env, CI: "true" },
          },
        );
        child.on("error", reject);
        child.on("close", resolve);
      });
      expect(result).toBe(change === "none" ? 0 : 1);
      expect(readFileSync(parentSentinel, "utf8")).toBe(
        "parent artifacts must survive the child run",
      );
      const report = JSON.parse(
        readFileSync(join(fixture.folder, "test-results/p1-candidate-binding.json"), "utf8"),
      );
      expect(report.testStatus).toBe("passed");
      expect(report.bindingStatus).toBe(change === "none" ? "passed" : "failed");
      expect(report.phaseDecision).toBe("not-issued");
      expect(report.attempts.passed).toBe(1);
    } finally {
      fixture.cleanup();
    }
  });
}
