#!/usr/bin/env node
// Seeds the fictional Saint-Henri dog walker of the demos (a walker + five clients with their dogs, a published shop page,
// a past walk with its report, an upcoming group walk) on the database of ONE deployment, through the product's own
// operations. Sign-up is closed there: these accounts are the only way in. Passwords come from the environment and are
// never printed; the maintainer keeps them in the QA sheet. Idempotent: a re-run only sets the passwords again.
//
//   DATABASE_URL=… DATABASE_CA_CERT=… APP_DATA_ENCRYPTION_KEY=… QA_WALKER_PASSWORD=… QA_CLIENTS_PASSWORD=… \
//     pnpm --filter @akinaza/web exec tsx scripts/seed-saint-henri.mjs
import { createDb, pg, poolConfig } from "@akinaza/db";
import { SAINT_HENRI_EMAILS, seedSaintHenri } from "@akinaza/db/seed-walker";

import { hashPassword } from "./qa-accounts.mjs";

const need = (name, min = 1) => {
  const value = process.env[name];
  if (!value || value.length < min) throw new Error(`${name} is missing${min > 1 ? ` or shorter than ${min} characters` : ""}`);
  return value;
};

async function main() {
  const walkerPassword = need("QA_WALKER_PASSWORD", 12);
  const clientsPassword = need("QA_CLIENTS_PASSWORD", 12);
  const key = Buffer.from(need("APP_DATA_ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) throw new Error("APP_DATA_ENCRYPTION_KEY must be 32 bytes, base64");
  const pool = new pg.Pool(poolConfig(need("DATABASE_URL"), process.env.DATABASE_CA_CERT, 2));
  try {
    for (const email of SAINT_HENRI_EMAILS) {
      const password = email === SAINT_HENRI_EMAILS[0] ? walkerPassword : clientsPassword;
      await pool.query(
        `INSERT INTO accounts (email, role, locale, password_hash) VALUES ($1, 'USER', $2, $3)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE'`,
        [email, "fr", await hashPassword(password)],
      );
      console.log(`seed-saint-henri: ${email} ready (password from the environment, not printed)`);
    }
    const result = await seedSaintHenri(createDb(pool), key, new Date());
    console.log(`seed-saint-henri: shop ${result.created ? "created" : "already there"}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`seed-saint-henri: ${error.message}`);
  process.exit(1);
});
