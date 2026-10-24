import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "transcription.spec.ts",
  outputDir: "../../test-results/transcription",
  workers: 1,
  reporter: "list",
});
