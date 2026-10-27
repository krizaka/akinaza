#!/usr/bin/env node
// Test-only: one visit TODAY for the demo owner (the Saint-Henri walker), one hour after the clock, so the phone's Maestro flow
// "Aujourd'hui" always goes list, detail, start, finish whatever time CI runs (krizaka/akinaza#433). The clock is `new Date()`, or
// SEED_NOW (an ISO instant) to replay a time; the date is never typed here. Run after seed-saint-henri.mjs; idempotent.
//
//   DATABASE_URL=… pnpm --filter @akinaza/web exec tsx scripts/seed-today-visit.mjs
import { createDb, pg, poolConfig } from "@akinaza/db";
import { seedTodayVisit } from "@akinaza/db/seed-walker";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing");
  const now = process.env.SEED_NOW ? new Date(process.env.SEED_NOW) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error("SEED_NOW is not a date");
  const pool = new pg.Pool(poolConfig(process.env.DATABASE_URL, process.env.DATABASE_CA_CERT, 2));
  try {
    const result = await seedTodayVisit(createDb(pool), now);
    console.log(`seed-today-visit: ${result.created ? "added" : "already there"} at ${result.startsAt.toISOString()}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`seed-today-visit: ${error.message}`);
  process.exit(1);
});
