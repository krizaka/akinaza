import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TABLE_OWNERSHIP } from "./tenancy";
import { freshDatabase } from "./test/db";

/** The tenant isolation audit (#247), read from the live catalogue of a migrated database - not from the schema file. */
let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const rows = async <R>(sql: string, params: unknown[] = []) => (await t.pool.query(sql, params)).rows as R[];

describe("every table says whose data it holds", () => {
  it("classifies every table of the database, and only those", async () => {
    const tables = (await rows<{ name: string }>("SELECT relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'")).map((r) => r.name).filter((n) => !n.startsWith("__"));
    const unclassified = tables.filter((n) => !(n in TABLE_OWNERSHIP));
    expect(unclassified, "add the table to TABLE_OWNERSHIP (packages/db/src/tenancy.ts) with the shop it belongs to").toEqual([]);
    expect(Object.keys(TABLE_OWNERSHIP).filter((n) => !tables.includes(n)), "a classified table that no longer exists").toEqual([]);
  });

  const of = (kind: string) => Object.entries(TABLE_OWNERSHIP).filter(([, o]) => o.kind === kind).map(([name]) => name);

  it.each(of("shop"))("%s: shop_id is NOT NULL, a foreign key to shops, and the leading column of an index", async (table) => {
    const [column] = await rows<{ notnull: boolean }>("SELECT attnotnull AS notnull FROM pg_attribute WHERE attrelid = $1::regclass AND attname = 'shop_id' AND NOT attisdropped", [table]);
    expect(column, `${table} has no shop_id`).toBeDefined();
    expect(column!.notnull).toBe(true);
    const [fk] = await rows<{ n: number }>(
      "SELECT count(*)::int AS n FROM pg_constraint k JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = ANY (k.conkey) WHERE k.conrelid = $1::regclass AND k.contype = 'f' AND a.attname = 'shop_id' AND k.confrelid = 'shops'::regclass",
      [table],
    );
    expect(fk!.n, `${table}.shop_id has no foreign key to shops`).toBeGreaterThan(0);
    const [index] = await rows<{ n: number }>(
      "SELECT count(*)::int AS n FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0] WHERE i.indrelid = $1::regclass AND a.attname = 'shop_id'",
      [table],
    );
    expect(index!.n, `${table} has no index led by shop_id`).toBeGreaterThan(0);
  });

  it.each([...of("child"), ...of("account")])("%s: its parent column is a foreign key to the parent the audit names", async (table) => {
    const o = TABLE_OWNERSHIP[table]!;
    if (o.kind !== "child" && o.kind !== "account") throw new Error("unreachable");
    if (table === "accounts") return; // an account is its own root
    const [fk] = await rows<{ n: number }>(
      "SELECT count(*)::int AS n FROM pg_constraint k JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = ANY (k.conkey) WHERE k.conrelid = $1::regclass AND k.contype = 'f' AND a.attname = $2 AND k.confrelid = $3::regclass",
      [table, o.via, o.parent],
    );
    expect(fk!.n, `${table}.${o.via} is not a foreign key to ${o.parent}`).toBe(1);
  });

  it("every child chain ends at a shop table, so no row of a shop is reachable without its shop", () => {
    for (const name of of("child")) {
      let at = TABLE_OWNERSHIP[name]!;
      for (let hops = 0; at.kind === "child"; hops++) {
        expect(hops, `${name}: the chain of parents is too long or loops`).toBeLessThan(5);
        at = TABLE_OWNERSHIP[at.parent]!;
        expect(at, `${name}: a parent is not classified`).toBeDefined();
      }
      expect(at.kind, `${name}: its chain must end at a table that carries shop_id`).toBe("shop");
    }
  });

  it.each(of("scoped"))("%s: its scope column is a foreign key to shops", async (table) => {
    const o = TABLE_OWNERSHIP[table]!;
    if (o.kind !== "scoped") throw new Error("unreachable");
    const [fk] = await rows<{ n: number }>(
      "SELECT count(*)::int AS n FROM pg_constraint k JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = ANY (k.conkey) WHERE k.conrelid = $1::regclass AND k.contype = 'f' AND a.attname = $2 AND k.confrelid = 'shops'::regclass",
      [table, o.column],
    );
    expect(fk!.n).toBe(1);
  });
});
