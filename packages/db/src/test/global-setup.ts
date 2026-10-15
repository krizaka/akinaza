import type { TestProject } from "vitest/node";

/**
 * One PostgreSQL 16 for the run: CI's service when DATABASE_URL is set, else a Testcontainers one (Docker), stopped at
 * the end. Never a shared or demo database: each test file creates its own database on it (./db.ts).
 */
export default async function setup(project: TestProject) {
  if (process.env.DATABASE_URL) {
    project.provide("adminUrl", process.env.DATABASE_URL);
    return;
  }
  const { PostgreSqlContainer } = await import("@testcontainers/postgresql");
  const container = await new PostgreSqlContainer("postgres:16-alpine").start();
  project.provide("adminUrl", container.getConnectionUri());
  return async () => {
    await container.stop();
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    adminUrl: string;
  }
}
