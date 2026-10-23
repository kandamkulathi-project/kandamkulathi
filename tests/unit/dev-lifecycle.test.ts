import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("supervised development server contract", () => {
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
