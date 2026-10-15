import path from "node:path";

import { createDb, type Db, migrate as migrateSchema, pg, poolConfig as dbPoolConfig } from "@akinaza/db";

import { readEnv } from "./env";

/**
 * One pool per process, on the shared rules of @akinaza/db (TLS verified against DATABASE_CA_CERT, never
 * `rejectUnauthorized: false`). `query` for the account and session SQL, `db()` for the Drizzle schema.
 */
export function poolConfig(source: Record<string, string | undefined> = process.env): pg.PoolConfig {
  const env = readEnv(source);
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  return dbPoolConfig(env.DATABASE_URL, env.DATABASE_CA_CERT);
}

const holder = globalThis as unknown as { __akinazaPool?: pg.Pool; __akinazaDb?: Db };

export function pool(): pg.Pool {
  holder.__akinazaPool ??= new pg.Pool(poolConfig());
  return holder.__akinazaPool;
}

export function db(): Db {
  holder.__akinazaDb ??= createDb(pool());
  return holder.__akinazaDb;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
  const result = await pool().query<T>(text, values);
  return result.rows;
}

/**
 * The versioned migrations of @akinaza/db (packages/db/drizzle), applied at start under an advisory lock. Resolved
 * from the app's directory — the same relative path in development and in the standalone server, which carries the
 * folder (next.config `outputFileTracingIncludes`).
 */
export const MIGRATIONS_DIR = path.resolve(process.cwd(), "../../packages/db/drizzle");
export async function migrate(): Promise<void> {
  await migrateSchema(pool(), MIGRATIONS_DIR);
}
