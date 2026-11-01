// `pnpm db:rebuild` — DROP every schema of the database in DATABASE_URL, migrate from zero, seed the configuration from code,
// verify the schema (krizaka-internal#2044). No production yet, dev data is demo: the demo cast is seeded after, by
// `scripts/seed-cast.mjs` (or `--cast` here). Flags: --yes (required for a non-local host), --cast (run the cast seed after),
// --write-expected (rewrite src/schema-expected.json from the fresh build).
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { pg, poolConfig } from "./client";
import { migrate } from "./migrate";
import { diffSnapshot, readSnapshot, type SchemaSnapshot } from "./schema-check";

const MIGRATIONS_DIR = fileURLToPath(new URL("../drizzle", import.meta.url));
const WEB_DIR = fileURLToPath(new URL("../../../apps/web", import.meta.url));
const EXPECTED = new URL("./schema-expected.json", import.meta.url);
const flag = (name: string) => process.argv.includes(`--${name}`);
const LOCAL = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "postgres", "db"]);

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (process.env.APP_ENVIRONMENT === "production") {
    throw new Error("db:rebuild never runs against production");
  }
  if (!LOCAL.has(url.hostname) && !flag("yes")) {
    throw new Error("DATABASE_URL is not a local database: pass --yes to rebuild it");
  }
  console.log(`db:rebuild (${LOCAL.has(url.hostname) ? "local" : "remote, --yes"} database)`);
  const pool = new pg.Pool(poolConfig(url.toString(), process.env.DATABASE_CA_CERT, 2));
  const { rows: schemas } = await pool.query<{ nspname: string }>(
    String.raw`SELECT nspname FROM pg_namespace WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'public') AND nspname NOT LIKE 'pg\_%'`,
  );
  for (const { nspname } of schemas) {
    await pool.query(`DROP SCHEMA "${nspname}" CASCADE`);
  }
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await migrate(pool, MIGRATIONS_DIR);
  console.log("migrated + configuration seeded");
  const actual = await readSnapshot(pool);
  if (flag("write-expected")) {
    await writeFile(EXPECTED, `${JSON.stringify(actual, null, 2)}\n`);
    console.log("src/schema-expected.json written");
  } else {
    const problems = diffSnapshot(JSON.parse(await readFile(EXPECTED, "utf8")) as SchemaSnapshot, actual);
    if (problems.length > 0) {
      throw new Error(`schema check failed:\n  ${problems.join("\n  ")}`);
    }
  }
  console.log(`schema check: ${Object.keys(actual.tables).length} tables, configuration present`);
  await pool.end();
  if (flag("cast")) {
    // The running node binary, not a name looked up on PATH.
    const run = spawnSync(process.execPath, ["--import", "tsx", "scripts/seed-cast.mjs", "--check"], {
      cwd: WEB_DIR,
      stdio: "inherit",
      env: process.env,
    });
    if (run.status !== 0) {
      throw new Error("the cast seed failed");
    }
  }
}

/** The first line a person needs: the cause of a wrapped error, else its message. */
function reason(error: unknown): string {
  if (error instanceof Error) {
    return error.cause instanceof Error ? error.cause.message : error.message;
  }
  return String(error);
}

try {
  await main();
  process.exit(0);
} catch (error) {
  console.error(reason(error).slice(0, 600));
  process.exit(1);
}
