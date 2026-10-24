import { defineConfig } from "@playwright/test";

/** Synthetic HTTP/controller tests: no web build, provider, database or device claim. */
export default defineConfig({
  testDir: ".",
  testMatch: "native-commerce-forms.spec.ts",
  workers: 1,
  reporter: "list",
  outputDir: "../../test-results/native-commerce-forms",
});
