import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Test-only alias for the exact leader-owned prerequisite. Production export
// registration remains with the coordinator; this does not alter a manifest.
export default defineConfig({
  resolve: {
    alias: {
      "@kandamkulathi/contracts/sensitive": fileURLToPath(
        new URL("../../packages/contracts/src/sensitive.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["tests/unit/customer-commerce-browser-payment.test.ts"],
    environment: "node",
    testTimeout: 10000,
  },
});
