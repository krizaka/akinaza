import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const dir = fileURLToPath(new URL("../drizzle/", import.meta.url));
const journal = JSON.parse(readFileSync(`${dir}meta/_journal.json`, "utf8")) as { entries: { idx: number; tag: string; when: number }[] };
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).map((f) => f.slice(0, -4)).sort();

it("the journal lists exactly the migration files, in order, with no gap and no duplicate number", () => {
  expect(journal.entries.map((e) => e.tag)).toEqual(files);
  expect(journal.entries.map((e) => e.idx)).toEqual(files.map((_, i) => i));
  expect(files.map((f) => Number(f.slice(0, 4)))).toEqual(files.map((_, i) => i));
});

it("the journal's dates only go up, so a late-landing migration is never skipped by a database that already ran a later one", () => {
  const whens = journal.entries.map((e) => e.when);
  expect(whens).toEqual([...whens].sort((a, b) => a - b));
  expect(new Set(whens).size).toBe(whens.length);
});
