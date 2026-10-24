import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "browser.spec.ts",
  outputDir: "../../test-results/video-proof-mount",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5197",
    browserName: "chromium",
    permissions: ["camera", "microphone"],
    launchOptions: {
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    },
  },
  webServer: {
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    command:
      "apps/workspaces/node_modules/.bin/vite --config tests/video-proof-mount/vite.config.ts",
    url: "http://127.0.0.1:5197",
    reuseExistingServer: false,
  },
});
