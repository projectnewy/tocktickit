import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    // Parallel test files truncating shared tables produce flaky, order-dependent
    // failures that look like application bugs. Serial execution costs a few
    // seconds at this scale and is worth it.
    fileParallelism: false,
  },
});
