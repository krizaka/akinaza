#!/usr/bin/env node
// Seeds « Krizaka (démo) » — a software studio in Montréal, the first client of Akinaza (dogfooding) — on the database of
// ONE deployment: its owner Éric, three fictional business clients, services billed by the hour or by the project, bilingual
// invoices and a quarter of books, through the product's own operations. Sign-up is closed there: these accounts are the only
// way in. Passwords come from the environment and are never printed. Idempotent: a re-run only sets the passwords again.
// Every figure is a demo figure (fake tax numbers, plausible amounts), never Krizaka's own.
//
//   DATABASE_URL=… DATABASE_CA_CERT=… QA_KRIZAKA_PASSWORD=… QA_CLIENTS_PASSWORD=… \
//     pnpm --filter @akinaza/web exec tsx scripts/seed-krizaka.mjs
import { createDb, pg, poolConfig } from "@akinaza/db";
import { KRIZAKA_EMAILS, seedKrizaka } from "@akinaza/db/seed-krizaka";

import { hashPassword } from "./qa-accounts.mjs";

const need = (name, min = 1) => {
  const value = process.env[name];
  if (!value || value.length < min) throw new Error(`${name} is missing${min > 1 ? ` or shorter than ${min} characters` : ""}`);
  return value;
};

async function main() {
  const ownerPassword = need("QA_KRIZAKA_PASSWORD", 12);
  const clientsPassword = need("QA_CLIENTS_PASSWORD", 12);
  const pool = new pg.Pool(poolConfig(need("DATABASE_URL"), process.env.DATABASE_CA_CERT, 2));
  try {
    for (const email of KRIZAKA_EMAILS) {
      const password = email === KRIZAKA_EMAILS[0] ? ownerPassword : clientsPassword;
      await pool.query(
        `INSERT INTO accounts (email, role, locale, password_hash) VALUES ($1, 'USER', $2, $3)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE'`,
        [email, "fr", await hashPassword(password)],
      );
      console.log(`seed-krizaka: ${email} ready (password from the environment, not printed)`);
    }
    const result = await seedKrizaka(createDb(pool), new Date());
    console.log(`seed-krizaka: shop ${result.created ? "created" : "already there"}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`seed-krizaka: ${error.message}`);
  process.exit(1);
});
