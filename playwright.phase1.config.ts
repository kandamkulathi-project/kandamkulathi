import { defineConfig } from "@playwright/test";
import baseline from "./playwright.config";

// Local scaffold boundaries only; never a substitute for the canonical G1 campaign.
// Build first, then serialize with /tmp/opencode/kandamkulathi-p1-e2e.lock.
export default defineConfig(baseline, {
  testDir: "./tests/phase1",
  testMatch: "baseline-smoke.spec.ts",
  outputDir: "test-results/phase1-baseline",
});
