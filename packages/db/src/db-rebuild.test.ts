import { readFileSync } from "node:fs";

import { afterAll, beforeAll, expect, it } from "vitest";

import { migrate } from "./migrate";
import { diffSnapshot, readSnapshot, type SchemaSnapshot } from "./schema-check";
import { freshEmptyDatabase } from "./test/db";

/**
 * The database rebuilds from ZERO (krizaka-internal#2044): a database of its own, the baseline, the configuration from code
 * (twice: idempotent) and the schema equal to the recorded one. A migration added without `pnpm db:rebuild --write-expected`,
 * or a config row missing, fails here.
 */
let empty: Awaited<ReturnType<typeof freshEmptyDatabase>>;
beforeAll(async () => {
  empty = await freshEmptyDatabase();
});
afterAll(async () => {
  await empty.drop();
});

it("builds from zero to the expected schema with its configuration, and a second run changes nothing", async () => {
  const folder = new URL("../drizzle", import.meta.url).pathname;
  await migrate(empty.pool, folder);
  await migrate(empty.pool, folder);
  const expected = JSON.parse(readFileSync(new URL("./schema-expected.json", import.meta.url), "utf8")) as SchemaSnapshot;
  expect(diffSnapshot(expected, await readSnapshot(empty.pool))).toEqual([]);
  const { rows } = await empty.pool.query<{ n: number }>("SELECT count(*)::int AS n FROM price_versions WHERE actor_label = 'migration prices-2026-10'");
  expect(rows[0]?.n).toBe(3);
});

it("lists exactly one migration, the baseline, in the journal", () => {
  const journal = JSON.parse(readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8")) as { entries: { tag: string }[] };
  expect(journal.entries.map((e) => e.tag)).toEqual(["0000_baseline"]);
});
