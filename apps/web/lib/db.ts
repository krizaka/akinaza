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
  return dbPoolConfig(env.DATABASE_URL, env.DATABASE_CA_CERT, env.DATABASE_MAX_CONNECTIONS);
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

/** What a transaction needs from the pool: one connection, given back after. */
export interface TransactionPool {
  connect(): Promise<{ query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[] }>; release: () => void }>;
}

/**
 * Runs `work` in one transaction on one connection: COMMIT when it returns, ROLLBACK when it throws. A failed ROLLBACK never
 * hides why the work failed: the original error comes first in an `AggregateError`.
 */
export async function transactionOn<T>(source: TransactionPool, work: (run: <R = Record<string, unknown>>(text: string, values?: unknown[]) => Promise<R[]>) => Promise<T>): Promise<T> {
  const client = await source.connect();
  try {
    await client.query("BEGIN");
    const out = await work(async (text, values) => (await client.query(text, values)).rows as never);
    await client.query("COMMIT");
    return out;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollback) {
      throw new AggregateError([error, rollback], "The transaction failed and could not be rolled back");
    }
    throw error;
  } finally {
    client.release();
  }
}

/** A transaction on this process's pool. */
export const transaction = <T>(work: Parameters<typeof transactionOn<T>>[1]) => transactionOn(pool() as unknown as TransactionPool, work);

/**
 * The versioned migrations of @akinaza/db (packages/db/drizzle), applied at start under an advisory lock. Resolved
 * from the app's directory — the same relative path in development and in the standalone server, which carries the
 * folder (next.config `outputFileTracingIncludes`).
 */
export const MIGRATIONS_DIR = path.resolve(process.cwd(), "../../packages/db/drizzle");

/**
 * Migrations need a session (an advisory lock), which a transaction pooler does not keep: they run on their own
 * one-connection pool, on DATABASE_DIRECT_URL when it is set, and the connection is closed right after.
 */
export function migrationPoolConfig(source: Record<string, string | undefined> = process.env): pg.PoolConfig {
  const env = readEnv(source);
  const url = env.DATABASE_DIRECT_URL || env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return dbPoolConfig(url, env.DATABASE_CA_CERT, 2);
}

export async function migrate(): Promise<void> {
  const migrationPool = new pg.Pool(migrationPoolConfig());
  try {
    await migrateSchema(migrationPool, MIGRATIONS_DIR);
  } finally {
    await migrationPool.end();
  }
}
