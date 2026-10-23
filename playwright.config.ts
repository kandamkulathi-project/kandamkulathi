import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  use: {
    baseURL: "http://127.0.0.1:4321",
    trace: "retain-on-failure",
  },
  reporter: process.env.CI ? "github" : "list",
  webServer: [
    {
      command: "pnpm --filter @kandamkulathi/web-public preview",
      url: "http://127.0.0.1:4321",
      reuseExistingServer: false,
    },
    {
      command: "pnpm --filter @kandamkulathi/workspaces preview",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: false,
    },
    {
      command: "pnpm dev:core",
      url: "http://127.0.0.1:8787/health/live",
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: "pnpm dev:companion",
      url: "http://127.0.0.1:8788/health/live",
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
