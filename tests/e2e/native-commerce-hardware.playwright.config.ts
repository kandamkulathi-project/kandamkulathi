import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "native-commerce-hardware.spec.ts",
  workers: 1,
  reporter: "list",
  outputDir: "../../test-results/native-commerce-hardware",
});
