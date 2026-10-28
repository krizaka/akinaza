#!/usr/bin/env node
// The whole Akinaza cast on a database, the same everywhere (krizaka/.github#356): local (`pnpm run dev:seed`), CI, Maestro, the
// recorders and the dev deployment. The Saint-Henri walker (Léa) with her shop, five clients with their dogs, and
// Éric (the Krizaka studio's owner), Mira (the administrator) — names, languages and roles come from `@krizaka/org`'s cast. Idempotent; refused outside dev.
// Addresses of the walker and the clients are the seed's own fictional `.test` ones; secrets come from the environment and are
// never printed (a database on this machine gets local defaults).
//
//   DATABASE_URL=… [DATABASE_CA_CERT=…] [APP_DATA_ENCRYPTION_KEY=…] [QA_WALKER_PASSWORD=… QA_CLIENTS_PASSWORD=… QA_ADMIN_EMAIL=… QA_ADMIN_PASSWORD=…] \
//     pnpm --filter @akinaza/web exec tsx scripts/seed-cast.mjs [--check]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createDb, migrate, pg, poolConfig } from "@akinaza/db";
import { SAINT_HENRI, SAINT_HENRI_EMAILS, seedSaintHenri } from "@akinaza/db/seed-walker";
import { castOf, persona, seedFingerprint } from "@krizaka/org";

import { hashPassword } from "./qa-accounts.mjs";

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

/** The accounts of the cast: the walker, the five clients (same order as the seed) and the administrator. */
export function castAccounts(env) {
  const local = isLocalHost(env.DATABASE_URL ?? "");
  const need = (name, fallback) => {
    const value = env[name] ?? (local ? fallback : undefined);
    if (!value || value.length < 12) throw new Error(`${name} is missing or shorter than 12 characters`);
    return value;
  };
  const walkerSecret = need("QA_WALKER_PASSWORD", LOCAL_SECRET);
  const clientsSecret = need("QA_CLIENTS_PASSWORD", LOCAL_SECRET);
  const addressOf = (name, p) => {
    const email = (env[name] ?? `${p.id}@demo.akinaza.test`).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw new Error(`${name} is invalid`);
    return email;
  };
  const clientPersonas = castOf("akinaza").filter((p) => p.role === "client");
  return [
    { persona: WALKER, email: SAINT_HENRI_EMAILS[0], role: "USER", secret: walkerSecret },
    ...clientPersonas.map((persona, i) => ({ persona, email: SAINT_HENRI_EMAILS[i + 1], role: "USER", secret: clientsSecret })),
    { persona: ERIC, email: addressOf("QA_USER_EMAIL", ERIC), role: "USER", secret: need("QA_USER_PASSWORD", LOCAL_SECRET) },
    { persona: ADMIN, email: addressOf("QA_ADMIN_EMAIL", ADMIN), role: "ADMIN", secret: need("QA_ADMIN_PASSWORD", LOCAL_SECRET) },
  ];
}

/** The tables the fingerprint counts, for the cast's accounts and their shop only (a dev database may hold other rows too). */
export const FINGERPRINT_QUERIES = {
  accounts: "SELECT count(*)::int AS n FROM accounts WHERE id = ANY($1)",
  shops: "SELECT count(*)::int AS n FROM shops WHERE owner_id = ANY($1)",
  clients: "SELECT count(*)::int AS n FROM clients WHERE shop_id IN (SELECT id FROM shops WHERE owner_id = ANY($1))",
  services: "SELECT count(*)::int AS n FROM services WHERE shop_id IN (SELECT id FROM shops WHERE owner_id = ANY($1))",
  appointments: "SELECT count(*)::int AS n FROM appointments WHERE shop_id IN (SELECT id FROM shops WHERE owner_id = ANY($1))",
  invoices: "SELECT count(*)::int AS n FROM invoices WHERE shop_id IN (SELECT id FROM shops WHERE owner_id = ANY($1))",
};

export async function fingerprintOf(query, ownerIds) {
  const counts = {};
  for (const [table, sql] of Object.entries(FINGERPRINT_QUERIES)) counts[table] = (await query(sql, [ownerIds])).rows[0].n;
  return { counts, fingerprint: seedFingerprint(counts) };
}

/** The seed works on dev and local only. */
export function assertNotProduction(env) {
  const environment = env.APP_ENVIRONMENT ?? "dev";
  if (environment !== "dev") throw new Error(`seed-cast works only on dev and local, and APP_ENVIRONMENT is "${environment}" — refused`);
}

async function main() {
  assertNotProduction(process.env);
  const env = process.env;
  const url = env.DATABASE_URL ?? "";
  if (!url) throw new Error("DATABASE_URL is required");
  const keyText = env.APP_DATA_ENCRYPTION_KEY ?? (isLocalHost(url) ? LOCAL_KEY : undefined);
  const key = Buffer.from(keyText ?? "", "base64");
  if (key.length !== 32) throw new Error("APP_DATA_ENCRYPTION_KEY must be 32 bytes, base64");
  const accounts = castAccounts(env);
  const pool = new pg.Pool(poolConfig(url, env.DATABASE_CA_CERT, 2));
  try {
    await migrate(pool, fileURLToPath(new URL("../../../packages/db/drizzle", import.meta.url))); // idempotent: the app does the same at start
    const ids = [];
    for (const a of accounts) {
      const [row] = (
        await pool.query(
          `INSERT INTO accounts (email, role, locale, name, email_verified_at, password_hash) VALUES ($1, $2, $3, $4, now(), $5)
           ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, status = 'ACTIVE', password_hash = EXCLUDED.password_hash, name = coalesce(accounts.name, EXCLUDED.name)
           RETURNING id`,
          [a.email, a.role, a.persona.locale, a.persona.displayName, await hashPassword(a.secret)],
        )
      ).rows;
      ids.push(row.id);
    }
    const result = await seedSaintHenri(createDb(pool), key, new Date());
    console.log(`seed-cast: ${WALKER.displayName} (${SAINT_HENRI.shop.name}), ${accounts.length - 3} clients, ${ERIC.displayName}, ${ADMIN.displayName} (administrator); shop ${result.created ? "created" : "already there"}`);
    const { fingerprint } = await fingerprintOf((sql, values) => pool.query(sql, values), ids);
    console.log(`fingerprint: ${fingerprint}`);
    if (process.argv.includes("--check")) {
      const expected = JSON.parse(readFileSync(new URL("./cast-fingerprint.json", import.meta.url), "utf8")).fingerprint;
      if (fingerprint !== expected) throw new Error(`the seeded data differs from the recorded fingerprint\n  expected ${expected}\n  got      ${fingerprint}`);
      console.log("fingerprint: matches the recorded one");
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
