import { defineConfig } from "@playwright/test";

/** Exercise the supervised development command, not the preview-server harness. */
export default defineConfig({
  testDir: "./tests/dev-e2e",
  outputDir: "./test-results/dev-lifecycle",
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 240000,
  use: { baseURL: "http://127.0.0.1:4321", trace: "retain-on-failure" },
  reporter: process.env.CI ? "github" : "list",
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:4321",
    reuseExistingServer: false,
    timeout: 120000,
    // Reproduce Astro's agent-inferred auto-backgrounding in CI and developer shells.
    env: { OPENCODE: "1", ASTRO_DEV_BACKGROUND: "" },
    gracefulShutdown: { signal: "SIGTERM", timeout: 10000 },
  },
});
