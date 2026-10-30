import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

import { endPool } from "@krizaka/db/testing";
import { inject } from "vitest";

import { createDb, type Db, pg } from "../client";
import { migrate } from "../migrate";

/** This package's versioned migrations. */
const MIGRATIONS_DIR = fileURLToPath(new URL("../../drizzle", import.meta.url));

/** A database of its own for a test file, migrated from scratch, dropped at the end. */
export async function freshDatabase(): Promise<{ db: Db; pool: pg.Pool; drop: () => Promise<void> }> {
  const empty = await freshEmptyDatabase();
  await migrate(empty.pool, MIGRATIONS_DIR);
  return empty;
}

/** The same, before any migration: for a test that applies them itself (a migration's own test). */
export async function freshEmptyDatabase(): Promise<{ db: Db; pool: pg.Pool; drop: () => Promise<void> }> {
  const admin = new URL(inject("adminUrl"));
  const name = `ak_it_${randomBytes(6).toString("hex")}`;
  const root = new pg.Client({ connectionString: admin.toString() });
  await root.connect();
  await root.query(`CREATE DATABASE ${name}`);
  await root.end();
  const url = new URL(admin.toString());
  url.pathname = `/${name}`;
  const pool = new pg.Pool({ connectionString: url.toString(), max: 4 });
  return {
    db: createDb(pool),
    pool,
    drop: async () => {
      await endPool(pool);
      const again = new pg.Client({ connectionString: admin.toString() });
      await again.connect();
      await again.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await again.end();
    },
  };
}

/** The message of the error a promise rejects with (PostgreSQL's RAISE text, or the app's). */
export async function refusal(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (error) {
    const e = error as { message?: string; cause?: { message?: string } };
    return `${e.message ?? ""} ${e.cause?.message ?? ""}`;
  }
  throw new Error("expected a refusal, got none");
}
