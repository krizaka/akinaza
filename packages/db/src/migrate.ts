import { migrate as drizzleMigrate } from "drizzle-orm/node-postgres/migrator";
import type pg from "pg";

import { createDb } from "./client";

/**
 * Applies the versioned SQL migrations of `folder` (this package's `drizzle/`, located by the caller — a bundler must
 * not guess it) not applied yet, under an advisory lock (two instances starting together never race). Drizzle
 * records them in `drizzle.__drizzle_migrations`; a merged migration is never edited.
 */
export async function migrate(pool: pg.Pool, folder: string): Promise<void> {
  const conn = await pool.connect();
  try {
    await conn.query("SELECT pg_advisory_lock(73193)");
    await drizzleMigrate(createDb(pool), { migrationsFolder: folder });
  } finally {
    await conn.query("SELECT pg_advisory_unlock(73193)").catch(() => undefined);
    conn.release();
  }
}
