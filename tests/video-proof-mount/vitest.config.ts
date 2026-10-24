import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["tests/video-proof-mount/*.test.ts"], environment: "node" },
});
