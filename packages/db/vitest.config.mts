import { defineConfig } from "vitest/config";

// The integration tests run on a real PostgreSQL 16: CI's service (DATABASE_URL), else a Testcontainers one started once
// for the run (src/test/global-setup.ts). Each test file gets a database of its own, migrated from scratch.
export default defineConfig({
  test: { include: ["src/**/*.test.ts"], globalSetup: ["./src/test/global-setup.ts"], testTimeout: 30_000, hookTimeout: 120_000, fileParallelism: false },
});
