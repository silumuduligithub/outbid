import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false, // Run tests sequentially for DB integrity
  },
});
