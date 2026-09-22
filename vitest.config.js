import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 45000,
    hookTimeout: 60000,
    fileParallelism: false, // tests share one DB — run files sequentially
  },
});
