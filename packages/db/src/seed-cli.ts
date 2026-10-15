// `DATABASE_URL=… pnpm --filter @akinaza/db seed you@example.com` — the demo shop for a development database of your own.
import { fileURLToPath } from "node:url";

import { createDb, pg, poolConfig } from "./client";
import { migrate } from "./migrate";
import { seedDemoShop } from "./seed";

/** This package's versioned migrations. */
const MIGRATIONS_DIR = fileURLToPath(new URL("../drizzle", import.meta.url));

const email = process.argv[2];
if (!email) throw new Error("usage: seed <account e-mail>");
const pool = new pg.Pool(poolConfig(process.env.DATABASE_URL ?? "", process.env.DATABASE_CA_CERT, 2));
await migrate(pool, MIGRATIONS_DIR);
const result = await seedDemoShop(createDb(pool), email);
await pool.end();
console.log(result.created ? `akinaza: demo shop ${result.shopId} created` : `akinaza: the account already has a shop (${result.shopId})`);
