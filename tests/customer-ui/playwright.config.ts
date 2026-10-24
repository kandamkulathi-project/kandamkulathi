import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "../e2e",
  testMatch: /customer-(commerce|booking).*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  use: { baseURL: "http://127.0.0.1:5184", trace: "retain-on-failure" },
  webServer: {
    command:
      "pnpm --filter @kandamkulathi/workspaces exec vite --config ../../tests/customer-ui/vite.config.ts",
    url: "http://127.0.0.1:5184",
    reuseExistingServer: false,
  },
});
