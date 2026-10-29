#!/usr/bin/env tsx
// Sets one administrator setting on the database of ONE deployment or a local run, through the same service the administration uses (`@krizaka/settings`:
// the row the console reads, the change audited as the given actor) — for a seeded demo or a capture run, never a way around the console in production.
// The script knows the setting by its kind only (it imports no application code: the app's registry pulls the whole domain in), so the value is validated
// by shape here and by the full registry when the app reads it.
//
//   DATABASE_URL=… pnpm --filter @akinaza/web exec tsx scripts/set-setting.mjs <key> <json-value> [--kind flag|choice|subset|integer] [--user <e-mail>] [--actor <e-mail or label>]
//   e.g.  … set-setting.mjs features.storefrontTemplates true
//         … set-setting.mjs features.cahierStorefront true --user ines.encrevive@akinaza.test   (one person's value: the demo shops' owners, never everyone)
//         … set-setting.mjs storefront.templates.offered '["salon-carte","pets-histoire"]' --kind subset
// The audit names the actor: an e-mail of an account is attributed to it; any other label is recorded without an account, as the app's own system actions are.
import { pg, poolConfig } from "@akinaza/db";
import { choice, defineSettings, flag, GLOBAL_ONLY, integer, postgresSettings, SCOPE, subset } from "@krizaka/settings";

const args = process.argv.slice(2);
const [key, raw] = args;
if (!key || raw === undefined) {
  console.error("usage: tsx scripts/set-setting.mjs <key> <json-value> [--kind flag|choice|subset|integer] [--actor <label>]");
  process.exit(2);
}
const option = (name, fallback) => {
  const at = args.indexOf(name);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};
const value = JSON.parse(raw);
const kind = option("--kind", typeof value === "boolean" ? "flag" : typeof value === "number" ? "integer" : Array.isArray(value) ? "subset" : "choice");
const actor = option("--actor", "set-setting.mjs");
const user = option("--user", "").trim().toLowerCase();
const group = key.split(".")[0];

/** The one definition the service needs for this key: its kind, the value as its own bounds. */
export function definitionFor(k, v, person = false) {
  if (person && k !== "flag") throw new Error("--user is for a flag: one person's switch (a beta)");
  switch (k) {
    case "flag":
      if (typeof v !== "boolean") throw new Error("a flag takes true or false");
      return person ? flag(group, v, [SCOPE.global, SCOPE.user]) : flag(group, v, GLOBAL_ONLY);
    case "integer":
      if (!Number.isInteger(v)) throw new Error("an integer takes a whole number");
      return integer(group, v, { min: v, max: v, unit: "" }, GLOBAL_ONLY);
    case "subset":
      if (!Array.isArray(v) || !v.length || !v.every((x) => typeof x === "string")) throw new Error("a subset takes a non-empty array of strings");
      return subset(group, v, v, GLOBAL_ONLY);
    case "choice":
      if (typeof v !== "string") throw new Error("a choice takes a string");
      return choice(group, [v], v, GLOBAL_ONLY);
    default:
      throw new Error(`unknown kind ${k} (flag, choice, subset, integer)`);
  }
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is missing");
const pool = new pg.Pool(poolConfig(url, process.env.DATABASE_CA_CERT, 2));
try {
  const registry = defineSettings({ [key]: definitionFor(kind, value, Boolean(user)) });
  const service = postgresSettings(registry, { query: async (sql, params) => (await pool.query(sql, params)).rows, clock: () => performance.now() });
  const account = actor.includes("@") ? (await pool.query("SELECT id FROM accounts WHERE email = $1", [actor.trim().toLowerCase()])).rows[0] : undefined;
  const person = user ? (await pool.query("SELECT id FROM accounts WHERE email = $1", [user])).rows[0] : undefined;
  if (user && !person) throw new Error(`no account ${user}`);
  await service.set({ id: account?.id ?? null, label: actor }, person ? { scope: "user", id: person.id } : { scope: "global", id: "" }, key, value, new Date());
  const whose = person ? " for " + user : "";
  console.log(`set-setting: ${key} = ${raw}${whose} (${kind}, by ${account ? "the account " + actor : actor + ", no account"})`);
} finally {
  await pool.end();
}
