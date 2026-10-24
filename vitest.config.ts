import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    // Real PostgreSQL suites create isolated databases and exercise concurrent
    // connections internally. Bound file parallelism to preserve server capacity.
    maxWorkers: 2,
    testTimeout: 10000,
  },
});
