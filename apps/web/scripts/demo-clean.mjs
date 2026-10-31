#!/usr/bin/env node
// Removes what a journey left on the demo shop: a dog, a booking, a client file the cast does not name (akinaza #1915). The journeys that
// write on dev call it when they end; `seed-cast.mjs --check` fails while anything is left. Dev and local only; prints counts, never a name.
// The connection comes from the environment, as for seed-cast.mjs.
//
//   pnpm --filter @akinaza/web exec tsx scripts/demo-clean.mjs
import { createDb, pg, poolConfig } from "@akinaza/db";
import { cleanDemoLeftovers } from "@akinaza/db/demo-clean";

import { assertNotProduction, DEMO_CAST } from "./seed-cast.mjs";

async function main() {
  assertNotProduction(process.env);
  const url = process.env.DATABASE_URL;
  if (!url) {throw new Error("the database address is required");}
  const pool = new pg.Pool(poolConfig(url, process.env.DATABASE_CA_CERT, 2));
  try {
    const c = await cleanDemoLeftovers(createDb(pool), DEMO_CAST);
    console.log(`demo-clean: ${c.clients} client file(s), ${c.dogs} dog(s), ${c.bookings} booking(s), ${c.visits} visit(s), ${c.accounts} sign-in(s) removed`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`demo-clean: ${error.message}`);
  process.exit(1);
});
