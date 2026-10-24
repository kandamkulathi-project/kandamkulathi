import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "web-consent-bootstrap.spec.ts",
  workers: 1,
  outputDir: "../../test-results/web-consent-bootstrap",
  use: { baseURL: "http://127.0.0.1:15379", trace: "retain-on-failure" },
  webServer: {
    command:
      "pnpm --filter @kandamkulathi/workspaces exec vite --config ../../tests/consent-bootstrap-browser/web-consent-bootstrap.vite.ts --host 127.0.0.1 --port 15379 --strictPort",
    url: "http://127.0.0.1:15379/__test-consent-bootstrap",
    reuseExistingServer: false,
  },
});
