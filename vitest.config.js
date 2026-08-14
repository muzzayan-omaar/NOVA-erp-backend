import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 15000,
    hookTimeout: 20000,
    fileParallelism: false, // tests share one DB — run files sequentially
  },
});
