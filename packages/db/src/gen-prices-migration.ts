import { PRICES_MIGRATION_SQL } from "./prices-migration";

/** `pnpm --filter @akinaza/db exec tsx src/gen-prices-migration.ts > drizzle/0035_prices.sql` */
process.stdout.write(PRICES_MIGRATION_SQL);
