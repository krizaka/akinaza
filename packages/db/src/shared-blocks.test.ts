import { organizeMigration } from "@krizaka/organize";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ACCOUNTS_MIGRATION_SQL } from "./account-migration";
import { API_KEYS_MIGRATION_SQL } from "./api-keys";
import { ORGANIZE_SCHEMA } from "./organize";
import { PRICES_MIGRATION_SQL } from "./prices-migration";
import { PRIVACY_INCIDENT_MIGRATION_SQL } from "./privacy-incident-migration";
import { PRIVACY_MIGRATION_BACKFILL, PRIVACY_MIGRATION_SQL } from "./privacy-migration";
import { ROLES_MIGRATION_SQL } from "./roles-migration";
import { SETTINGS_MIGRATION_SQL } from "./settings-migration";
import { freshDatabase } from "./test/db";
import { WEBHOOKS_MIGRATION_SQL } from "./webhooks-migration";
import { WORKSPACE, workspaceMigration } from "./workspace";

/**
 * The baseline still holds what the shared Krizaka blocks make TODAY (krizaka-internal#2044). Before the squash, a test compared each
 * migration file with its block's text, so a package that changed its block failed the build until a migration followed. The files are
 * gone; this keeps the guard: every table, column, function, trigger and module marker a block creates is in a database built from zero.
 */
const BLOCKS: Record<string, string> = {
  "api-keys (@krizaka/api-keys)": API_KEYS_MIGRATION_SQL,
  "accounts (@krizaka/auth)": ACCOUNTS_MIGRATION_SQL,
  "settings (@krizaka/settings)": SETTINGS_MIGRATION_SQL,
  "webhooks (@krizaka/webhooks)": WEBHOOKS_MIGRATION_SQL,
  "shop roles (@krizaka/auth)": ROLES_MIGRATION_SQL,
  "prices (@krizaka/settings)": PRICES_MIGRATION_SQL,
  "privacy v1 (@krizaka/privacy)": PRIVACY_MIGRATION_SQL.replace(PRIVACY_MIGRATION_BACKFILL, ""),
  "privacy v2, the incident register (@krizaka/privacy)": PRIVACY_INCIDENT_MIGRATION_SQL,
  "organize (@krizaka/organize)": organizeMigration(ORGANIZE_SCHEMA),
  "workspace (@krizaka/organize)": workspaceMigration(WORKSPACE),
};

const CONSTRAINT_WORDS = new Set(["constraint", "primary", "unique", "check", "foreign", "exclude", "like"]);
const qualified = (name: string) => {
  const bare = name.replaceAll('"', "").toLowerCase();
  return bare.includes(".") ? bare : `public.${bare}`;
};

/** The top-level items of a parenthesised list (commas inside nested parentheses or quotes do not split). */
function items(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = "";
  for (const ch of body) {
    if (ch === "'") quoted = !quoted;
    if (!quoted && ch === "(") depth++;
    if (!quoted && ch === ")") depth--;
    if (!quoted && depth === 0 && ch === ",") {
      out.push(current);
      current = "";
    } else current += ch;
  }
  return [...out, current].map((s) => s.replace(/--[^\n]*/g, "").trim()).filter(Boolean);
}

/** What a block creates: "schema.table.column", functions and triggers. */
function objectsOf(sql: string): { columns: string[]; functions: string[]; triggers: string[]; markers: string[] } {
  const columns: string[] = [];
  for (const m of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?([\w."]+)\s*\(/gi)) {
    const start = m.index + m[0].length;
    let depth = 1;
    let end = start;
    while (depth > 0 && end < sql.length) {
      if (sql[end] === "(") depth++;
      if (sql[end] === ")") depth--;
      end++;
    }
    for (const item of items(sql.slice(start, end - 1))) {
      const word = item.split(/\s+/)[0]!.replaceAll('"', "").toLowerCase();
      if (!CONSTRAINT_WORDS.has(word)) columns.push(`${qualified(m[1]!)}.${word}`);
    }
  }
  for (const m of sql.matchAll(/ALTER TABLE (?:IF EXISTS )?(?:ONLY )?([\w."]+)\s+([^;]+);/gi)) {
    for (const c of m[2]!.matchAll(/ADD COLUMN (?:IF NOT EXISTS )?([\w"]+)/gi)) columns.push(`${qualified(m[1]!)}.${c[1]!.replaceAll('"', "").toLowerCase()}`);
  }
  const functions = [...sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION ([\w."]+)\s*\(/gi)].map((m) => qualified(m[1]!));
  const triggers = [...sql.matchAll(/CREATE (?:OR REPLACE )?(?:CONSTRAINT )?TRIGGER ([\w"]+)/gi)].map((m) => m[1]!.replaceAll('"', "").toLowerCase());
  const markers = [...sql.matchAll(/INSERT INTO public\.krizaka_module_versions \(module, version, checksum\) VALUES \('([^']+)', (\d+), '([0-9a-f]+)'\)/gi)].map((m) => `${m[1]}@${m[2]}:${m[3]}`);
  return { columns, functions, triggers, markers };
}

let t: Awaited<ReturnType<typeof freshDatabase>>;
let have: { columns: Set<string>; functions: Set<string>; triggers: Set<string>; markers: Set<string> };
beforeAll(async () => {
  t = await freshDatabase();
  const q = async (text: string) => new Set((await t.pool.query<{ x: string }>(text)).rows.map((r) => r.x));
  have = {
    columns: await q("SELECT table_schema || '.' || table_name || '.' || column_name AS x FROM information_schema.columns"),
    functions: await q("SELECT n.nspname || '.' || p.proname AS x FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace"),
    triggers: await q("SELECT tgname AS x FROM pg_trigger WHERE NOT tgisinternal"),
    markers: await q("SELECT module || '@' || version || ':' || checksum AS x FROM public.krizaka_module_versions"),
  };
});
afterAll(async () => t.drop());

describe("the baseline holds every shared block as the packages print it today", () => {
  it("reads something out of every block (the parser is not silently empty)", () => {
    for (const [name, sql] of Object.entries(BLOCKS)) {
      const o = objectsOf(sql);
      expect(o.columns.length + o.functions.length + o.triggers.length, name).toBeGreaterThan(0);
    }
  });

  for (const [name, sql] of Object.entries(BLOCKS)) {
    it(name, () => {
      const o = objectsOf(sql);
      expect(o.columns.filter((c) => !have.columns.has(c)), "columns").toEqual([]);
      expect(o.functions.filter((f) => !have.functions.has(f)), "functions").toEqual([]);
      expect(o.triggers.filter((x) => !have.triggers.has(x)), "triggers").toEqual([]);
      expect(o.markers.filter((m) => !have.markers.has(m)), "module markers (version and checksum)").toEqual([]);
    });
  }
});
