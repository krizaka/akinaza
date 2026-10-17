#!/usr/bin/env node
// Resets the fictional Saint-Henri walker's dev data before a recording: the future bookings are cancelled and each of the
// five clients gets one open group walk at the next 14:00 slot (packages/db/src/qa-reset-walker.ts). Only the shop with the
// persona's slug is touched; nothing is printed but the counts. Idempotent.
//
//   DATABASE_URL=… DATABASE_CA_CERT=… pnpm --filter @akinaza/web exec tsx scripts/qa-reset-walker.mjs
import { createDb, pg, poolConfig } from "@akinaza/db";
import { resetWalkerPersona } from "@akinaza/db/qa-reset-walker";

const SLUG = "pattes-saint-henri";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is missing");
  const pool = new pg.Pool(poolConfig(url, process.env.DATABASE_CA_CERT, 2));
  try {
    const { rows } = await pool.query("SELECT id FROM shops WHERE slug = $1", [SLUG]);
    if (rows.length !== 1) throw new Error(`no shop with the slug ${SLUG}: seed the persona first`);
    const result = await resetWalkerPersona(createDb(pool), rows[0].id, new Date());
    process.stdout.write(`walker persona reset: ${result.cancelled} booking(s) cancelled, ${result.recreated} open visit(s) recreated\n`);
  } finally {
    await pool.end();
  }
}

main().then(() => process.exit(0)).catch((error) => {
  process.stderr.write(`✗ ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
