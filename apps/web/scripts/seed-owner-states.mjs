#!/usr/bin/env node
// Seeds the two owner states the page audit crawls (akinaza#405): an owner whose shop is EMPTY and an owner whose shop has ONE item per list,
// through the product's own operations, on the database of ONE deployment (the same dataset locally and deployed). Sign-up is closed there:
// these accounts are the only way in. The password comes from the environment and is never printed. Idempotent.
//
//   DATABASE_URL=… DATABASE_CA_CERT=… QA_OWNER_STATES_PASSWORD=… pnpm --filter @akinaza/web exec tsx scripts/seed-owner-states.mjs
import { createDb, pg, poolConfig } from "@akinaza/db";
import { OWNER_STATE_EMAILS, seedOwnerStates } from "@akinaza/db/seed-owner-states";

import { hashPassword } from "./qa-accounts.mjs";

const need = (name, min = 1) => {
  const value = process.env[name];
  if (!value || value.length < min) {throw new Error(`${name} is missing or shorter than ${min} characters`);}
  return value;
};

/** The accounts of the two owners and of the lone client (one password), then their shops: idempotent. `seed-cast.mjs` calls it too (the dev seed). */
export async function ensureOwnerStates(pool, password) {
  for (const email of OWNER_STATE_EMAILS) {
    await pool.query(
      `INSERT INTO accounts (email, role, locale, password_hash) VALUES ($1, 'USER', $2, $3)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE'`,
      [email, "fr", await hashPassword(password)],
    );
  }
  return seedOwnerStates(createDb(pool), new Date());
}

async function main() {
  const password = need("QA_OWNER_STATES_PASSWORD", 12);
  const pool = new pg.Pool(poolConfig(need("DATABASE_URL"), process.env.DATABASE_CA_CERT, 2));
  try {
    await ensureOwnerStates(pool, password);
    console.log(`seed-owner-states: ${OWNER_STATE_EMAILS.length} accounts and 2 shops ready (password from the environment, not printed)`);
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`seed-owner-states: ${error.message}`);
    process.exit(1);
  });
}
