#!/usr/bin/env node
// Gives the fictional Saint-Henri dog walker's shop its storefront (locality, bio, contact, the services' sentences and
// inclusions, the areas' map positions, the cover and the gallery) on the database of ONE deployment — through the product's
// own operations, and without touching an account or a password. Idempotent. The shop must already be seeded
// (seed-saint-henri.mjs); the migration that adds the columns is applied when the app starts. Reads DATABASE_URL,
// DATABASE_CA_CERT and APP_DATA_ENCRYPTION_KEY from the environment, like the seed:
//
//   pnpm --filter @akinaza/web exec tsx scripts/enrich-saint-henri.mjs
import { createDb, pg, poolConfig } from "@akinaza/db";
import { seedSaintHenri } from "@akinaza/db/seed-walker";

const need = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing`);
  return value;
};

const key = Buffer.from(need("APP_DATA_ENCRYPTION_KEY"), "base64");
if (key.length !== 32) throw new Error("APP_DATA_ENCRYPTION_KEY must be 32 bytes, base64");
const pool = new pg.Pool(poolConfig(need("DATABASE_URL"), process.env.DATABASE_CA_CERT, 2));
try {
  const result = await seedSaintHenri(createDb(pool), key, new Date());
  console.log(`enrich-saint-henri: shop ${result.created ? "created" : "enriched"}`);
} finally {
  await pool.end();
}
