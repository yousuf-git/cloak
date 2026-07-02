import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Integration suites share one MongoDB — run files sequentially so their
    // per-test collection resets never wipe another file's data mid-flight.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/cloak-test',
      JWT_SECRET: 'test-jwt-secret-test-jwt-secret-0123456789',
      REFRESH_SECRET: 'test-refresh-secret-test-refresh-secret-0123',
    },
  },
});
