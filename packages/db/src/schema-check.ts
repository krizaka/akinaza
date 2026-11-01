import type pg from "pg";

/**
 * The schema check of a rebuilt database (krizaka-internal#2044): every table and column the application needs
 * (`schema-expected.json`, written by `pnpm db:rebuild --write-expected` from a fresh build) and the configuration keys the code seeds.
 * A column added by a migration without the snapshot, or a config row missing, fails — locally, in CI and on dev.
 */
export interface SchemaSnapshot {
  /** "schema.table" → its columns, sorted. */
  tables: Record<string, string[]>;
  /** Configuration table → its keys, sorted. */
  config: Record<string, string[]>;
}

// @fixed: the tables whose rows are configuration seeded from code (price-schedule.ts), with the column naming the row
export const CONFIG_KEYS: Readonly<Record<string, string>> = { "public.price_versions": "key" };

// @fixed: the runner's own bookkeeping, not part of the application's schema
const IGNORED_SCHEMAS = new Set(["drizzle", "pg_catalog", "information_schema"]);

export async function readSnapshot(pool: pg.Pool): Promise<SchemaSnapshot> {
  const { rows } = await pool.query<{ t: string; c: string; s: string }>(
    `SELECT table_schema AS s, table_schema || '.' || table_name AS t, column_name AS c
       FROM information_schema.columns ORDER BY 2, 3`,
  );
  const tables: Record<string, string[]> = {};
  for (const { s, t, c } of rows) {
    if (IGNORED_SCHEMAS.has(s)) {
      continue;
    }
    tables[t] = [...(tables[t] ?? []), c];
  }
  const config: Record<string, string[]> = {};
  for (const [table, key] of Object.entries(CONFIG_KEYS)) {
    const found = await pool.query<{ k: string }>(`SELECT DISTINCT ${key}::text AS k FROM ${table} ORDER BY 1`);
    config[table] = found.rows.map((r) => r.k);
  }
  return { tables, config };
}

function diffTable(table: string, want: string[], have: string[] | undefined): string[] {
  if (!have) {
    return [`missing table ${table}`];
  }
  return [
    ...want.filter((c) => !have.includes(c)).map((c) => `missing column ${table}.${c}`),
    ...have.filter((c) => !want.includes(c)).map((c) => `unexpected column ${table}.${c}`),
  ];
}

/** What the expected snapshot needs and the database lacks (or has in excess): one line each; empty = the schema is right. */
export function diffSnapshot(expected: SchemaSnapshot, actual: SchemaSnapshot): string[] {
  return [
    ...Object.entries(expected.tables).flatMap(([table, cols]) => diffTable(table, cols, actual.tables[table])),
    ...Object.keys(actual.tables)
      .filter((table) => !expected.tables[table])
      .map((table) => `unexpected table ${table}`),
    ...Object.entries(expected.config).flatMap(([table, keys]) =>
      keys.filter((k) => !actual.config[table]?.includes(k)).map((k) => `missing config ${table} ${k}`),
    ),
  ];
}
