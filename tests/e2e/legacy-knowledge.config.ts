import { defineConfig } from "@playwright/test";

// Focused standalone runner. The full suite needs the same harness webServer entry.
export default defineConfig({
  testDir: ".",
  testMatch: [
    "knowledge-editor-recovery.spec.ts",
    "knowledge-save-correlation.spec.ts",
    "knowledge-foundation.spec.ts",
  ],
  fullyParallel: true,
  workers: 2,
  use: { trace: "retain-on-failure" },
  webServer: [
    {
      command:
        "pnpm --filter @kandamkulathi/workspaces exec vite --config ../../tests/e2e/legacy-knowledge.vite.ts --host 127.0.0.1 --port 15375 --strictPort",
      url: "http://127.0.0.1:15375/__legacy-knowledge/staff",
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
