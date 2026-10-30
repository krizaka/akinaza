#!/usr/bin/env node
// The whole Akinaza cast on a database, the same everywhere (krizaka/.github#356): local (`pnpm run dev:seed`), CI, Maestro, the
// recorders and the dev deployment. The Saint-Henri walker (Léa) with her shop, five clients with their dogs, and
// Éric (the Krizaka studio's owner), Mira (the administrator) — names, languages and roles come from `@krizaka/org`'s cast. Idempotent; refused outside dev.
// Addresses of the walker and the clients are the seed's own fictional `.test` ones; secrets come from the environment and are
// never printed (a database on this machine gets local defaults).
//
//   DATABASE_URL=… [DATABASE_CA_CERT=…] [APP_DATA_ENCRYPTION_KEY=…] [QA_WALKER_PASSWORD=… QA_CLIENTS_PASSWORD=… QA_ADMIN_EMAIL=… QA_ADMIN_PASSWORD=… QA_KRIZAKA_PASSWORD=…] \
//     pnpm --filter @akinaza/web exec tsx scripts/seed-cast.mjs [--check]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createDb, migrate, pg, poolConfig } from "@akinaza/db";
import { SAINT_HENRI, SAINT_HENRI_EMAILS, seedSaintHenri } from "@akinaza/db/seed-walker";
import { castOf, persona, seedFingerprint } from "@krizaka/org";

import { hashPassword } from "./qa-accounts.mjs";
import { ensureOwnerStates } from "./seed-owner-states.mjs";

/** What a LOCAL database gets when nothing is given. Never used on a host that is not this machine. */
export const LOCAL_SECRET = "local-cast-password-0123";
const LOCAL_KEY = Buffer.alloc(32, "akinaza-local-cast").toString("base64");

const isLocalHost = (databaseUrl) => {
  try {
    return ["localhost", "127.0.0.1", "::1", "[::1]", "postgres", "db"].includes(new URL(databaseUrl).hostname);
  } catch {
    return false;
  }
};

export const WALKER = persona("akinaza", "lea");
export const ERIC = persona("akinaza", "eric");
export const ADMIN = persona("akinaza", "mira");
/** The company's own account: it owns the real Krizaka shop (akinaza#489), set up through the owner console. Not a demo persona, not a person's login. */
export const KRIZAKA = { id: "krizaka", displayName: "Krizaka", locale: "fr", avatar: "krizaka" };
export const KRIZAKA_EMAIL = "akinaza@krizaka.com";

/** The accounts of the cast: the walker, the five clients (same order as the seed) and the administrator. */
export function castAccounts(env) {
  const local = isLocalHost(env.DATABASE_URL ?? "");
  const need = (name, fallback) => {
    const value = env[name] ?? (local ? fallback : undefined);
    if (!value || value.length < 12) {throw new Error(`${name} is missing or shorter than 12 characters`);}
    return value;
  };
  const walkerSecret = need("QA_WALKER_PASSWORD", LOCAL_SECRET);
  const clientsSecret = need("QA_CLIENTS_PASSWORD", LOCAL_SECRET);
  const addressOf = (name, p) => {
    const email = (env[name] ?? `${p.id}@demo.akinaza.test`).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+$/.test(email)) {throw new Error(`${name} is invalid`);}
    return email;
  };
  const clientPersonas = castOf("akinaza").filter((p) => p.role === "client");
  return [
    { persona: WALKER, email: SAINT_HENRI_EMAILS[0], role: "USER", secret: walkerSecret },
    ...clientPersonas.map((persona, i) => ({ persona, email: SAINT_HENRI_EMAILS[i + 1], role: "USER", secret: clientsSecret })),
    { persona: ERIC, email: addressOf("QA_USER_EMAIL", ERIC), role: "USER", secret: need("QA_USER_PASSWORD", LOCAL_SECRET) },
    { persona: KRIZAKA, email: (env.QA_KRIZAKA_EMAIL ?? KRIZAKA_EMAIL).trim().toLowerCase(), role: "USER", secret: need("QA_KRIZAKA_PASSWORD", LOCAL_SECRET) },
    { persona: ADMIN, email: addressOf("QA_ADMIN_EMAIL", ADMIN), role: "ADMIN", secret: need("QA_ADMIN_PASSWORD", LOCAL_SECRET) },
  ];
}

/**
 * The tables the fingerprint counts: the cast's accounts (a list), and the walker's shop with what hangs on it (her id). Éric and Mira may own
 * other rows on a dev database (a studio's shop, older demo data): they are not the seed's, so they never enter the count.
 */
export const FINGERPRINT_QUERIES = {
  accounts: "SELECT count(*)::int AS n FROM accounts WHERE id = ANY($1)",
  shops: "SELECT count(*)::int AS n FROM shops WHERE owner_id = $1",
  clients: "SELECT count(*)::int AS n FROM clients WHERE shop_id IN (SELECT id FROM shops WHERE owner_id = $1)",
  services: "SELECT count(*)::int AS n FROM services WHERE shop_id IN (SELECT id FROM shops WHERE owner_id = $1)",
  appointments: "SELECT count(*)::int AS n FROM appointments WHERE shop_id IN (SELECT id FROM shops WHERE owner_id = $1)",
  invoices: "SELECT count(*)::int AS n FROM invoices WHERE shop_id IN (SELECT id FROM shops WHERE owner_id = $1)",
};

export async function fingerprintOf(query, accountIds, walkerId) {
  const counts = {};
  for (const [table, sql] of Object.entries(FINGERPRINT_QUERIES)) {
    const values = sql.includes("ANY($1)") ? [accountIds] : [walkerId];
    counts[table] = (await query(sql, values)).rows[0].n;
  }
  return { counts, fingerprint: seedFingerprint(counts) };
}

/**
 * Whether a database holds the recorded cast. A local or CI database is the seed's alone: the fingerprint is exact. The shared dev
 * database is lived in (bookings made in the app, other tests add clients and appointments), and the seed leaves a shop that already
 * has its invoices alone, so there the check is « everything recorded is there »: the accounts exactly, every other count at least.
 */
export function matchesRecorded(counts, expected, exact) {
  const recorded = Object.fromEntries(expected.split(";").map((pair) => pair.split("=")).map(([k, v]) => [k, Number(v)]));
  return Object.entries(recorded).every(([table, n]) => (exact || table === "accounts" ? counts[table] === n : counts[table] >= n));
}

/** The seed works on dev and local only. */
export function assertNotProduction(env) {
  const environment = env.APP_ENVIRONMENT ?? "dev";
  if (environment !== "dev") {throw new Error(`seed-cast works only on dev and local, and APP_ENVIRONMENT is "${environment}" — refused`);}
}

async function main() {
  assertNotProduction(process.env);
  const env = process.env;
  const url = env.DATABASE_URL ?? "";
  if (!url) {throw new Error("DATABASE_URL is required");}
  const keyText = env.APP_DATA_ENCRYPTION_KEY ?? (isLocalHost(url) ? LOCAL_KEY : undefined);
  const key = Buffer.from(keyText ?? "", "base64");
  if (key.length !== 32) {throw new Error("APP_DATA_ENCRYPTION_KEY must be 32 bytes, base64");}
  const accounts = castAccounts(env);
  const pool = new pg.Pool(poolConfig(url, env.DATABASE_CA_CERT, 2));
  try {
    await migrate(pool, fileURLToPath(new URL("../../../packages/db/drizzle", import.meta.url))); // idempotent: the app does the same at start
    const ids = [];
    // The visual run fixes the instant the pages are drawn at (APP_FIXED_NOW, dev only): the cast is seeded around the same one.
    const fixedNow = process.env.APP_FIXED_NOW;
    for (const a of accounts) {
      const [row] = (
        await pool.query(
          `INSERT INTO accounts (email, role, locale, name, avatar_seed, email_verified_at, password_hash) VALUES ($1, $2, $3, $4, $6, now(), $5)
           ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, status = 'ACTIVE', password_hash = EXCLUDED.password_hash, name = coalesce(accounts.name, EXCLUDED.name), avatar_seed = EXCLUDED.avatar_seed
           RETURNING id`,
          [a.email, a.role, a.persona.locale, a.persona.displayName, await hashPassword(a.secret), a.persona.avatar],
        )
      ).rows;
      ids.push(row.id);
    }
    const result = await seedSaintHenri(createDb(pool), key, fixedNow ? new Date(fixedNow) : new Date());
    console.log(`seed-cast: ${WALKER.displayName} (${SAINT_HENRI.shop.name}), ${accounts.length - 4} clients, ${ERIC.displayName}, ${ADMIN.displayName} (administrator); shop ${result.created ? "created" : "already there"}`);
    // The two owner states of the page audit (#405: an empty shop, a shop with one item per list): outside the fingerprint, which counts the cast alone.
    await ensureOwnerStates(pool, accounts[0].secret);
    const { fingerprint, counts } = await fingerprintOf((sql, values) => pool.query(sql, values), ids, ids[0]);
    console.log(`fingerprint: ${fingerprint}`);
    if (process.argv.includes("--check")) {
      const expected = JSON.parse(readFileSync(new URL("./cast-fingerprint.json", import.meta.url), "utf8")).fingerprint;
      const exact = isLocalHost(url);
      if (!matchesRecorded(counts, expected, exact)) {throw new Error(`the seeded data differs from the recorded fingerprint\n  expected ${expected}\n  got      ${fingerprint}`);}
      console.log(exact ? "fingerprint: matches the recorded one" : "fingerprint: everything recorded is there (this database is lived in: counts may exceed it)");
    }
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`seed-cast: ${error.message}`);
    process.exit(1);
  });
}
