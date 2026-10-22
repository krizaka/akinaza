// `DATABASE_URL=… pnpm --filter @akinaza/db seed:demos` — the three fictional demo shops (salon, tattoo and photo studio, consultant).
import { fileURLToPath } from "node:url";

import { createDb, pg, poolConfig } from "./client";
import { seedDemoShops } from "./demo-shops";
import { migrate } from "./migrate";

/** This package's versioned migrations. */
const MIGRATIONS_DIR = fileURLToPath(new URL("../drizzle", import.meta.url));

const pool = new pg.Pool(poolConfig(process.env.DATABASE_URL ?? "", process.env.DATABASE_CA_CERT, 2));
await migrate(pool, MIGRATIONS_DIR);
for (const s of await seedDemoShops(createDb(pool))) console.log(`akinaza: /s/${s.slug} ${s.created ? "created" : "already there"} (${s.shopId})`);
await pool.end();
