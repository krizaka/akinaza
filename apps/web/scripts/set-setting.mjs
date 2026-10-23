#!/usr/bin/env tsx
// Sets one administrator setting on the database of ONE deployment or a local run, through the same service the administration uses (validated
// against the registry, audited as the given actor) — for a seeded demo or a capture run, never a way around the console in production.
//
//   DATABASE_URL=… pnpm --filter @akinaza/web exec tsx scripts/set-setting.mjs <key> <json-value> [--actor <label>]
//   e.g.  … set-setting.mjs features.storefrontTemplates true
import { pg, poolConfig } from "@akinaza/db";
import { postgresSettings } from "@krizaka/settings";

import { settings } from "../lib/settings";

const [key, raw, ...rest] = process.argv.slice(2);
if (!key || raw === undefined) {
  console.error("usage: tsx scripts/set-setting.mjs <key> <json-value> [--actor <label>]");
  process.exit(2);
}
const actor = rest[0] === "--actor" && rest[1] ? rest[1] : "set-setting.mjs";
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is missing");
const pool = new pg.Pool(poolConfig(url, process.env.DATABASE_CA_CERT, 2));
try {
  const service = postgresSettings(settings, { query: async (sql, params) => (await pool.query(sql, params)).rows, clock: () => performance.now() });
  await service.set({ id: "script", label: actor }, { scope: "global", id: "" }, key, JSON.parse(raw), new Date());
  console.log(`set-setting: ${key} = ${raw}`);
} finally {
  await pool.end();
}
