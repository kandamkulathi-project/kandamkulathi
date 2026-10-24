import { defineConfig } from "@playwright/test";

// Deliberately use development React: production preview cannot reproduce effect replay.
export default defineConfig({
  testDir: ".",
  testMatch: [
    "web-strict-lifecycle.spec.ts",
    "workspace-authoring.spec.ts",
    "workspace-consent-bootstrap.spec.ts",
  ],
  workers: 1,
  use: { baseURL: "http://127.0.0.1:15374", trace: "retain-on-failure" },
  webServer: {
    command:
      "pnpm --filter @kandamkulathi/workspaces exec vite --config ../../tests/e2e/web-strict-lifecycle.vite.ts --host 127.0.0.1 --port 15374 --strictPort",
    url: "http://127.0.0.1:15374",
    reuseExistingServer: false,
  },
});
