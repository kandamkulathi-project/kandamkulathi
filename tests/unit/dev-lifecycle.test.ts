import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import developmentConfig from "../../playwright.dev.config";

describe("supervised development server contract", () => {
  it("isolates development output from the main campaign's candidate binding", () => {
    const binding = resolve("test-results/p1-candidate-binding.json");
    expect(developmentConfig.outputDir).toBe("./test-results/dev-lifecycle");
    expect(resolve(developmentConfig.outputDir ?? "test-results")).not.toBe(dirname(binding));
  });
  it.each(["dev", "preview"])(
    "keeps Astro %s in the foreground when an agent is detected",
    (mode) => {
      const manifest = JSON.parse(
        readFileSync(new URL("../../apps/web-public/package.json", import.meta.url), "utf8"),
      );
      const args = manifest.scripts[mode].split(/\s+/);
      expect(args.slice(0, 2)).toEqual(["astro", mode]);
      expect(args).toContain("--ignore-lock");
      expect(args).not.toContain("--background");
      expect(args).not.toContain("--force");
      expect(args).toContain("127.0.0.1");
    },
  );
});
