import { defineConfig } from "@playwright/test";

/** Focused API-only E2E; the normal repository config also includes commerce.spec.ts. */
export default defineConfig({
  testDir: ".",
  testMatch: "commerce.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  forbidOnly: Boolean(process.env.CI),
});
