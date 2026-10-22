import { ACCOUNTS_MIGRATION_SQL } from "./account-migration";

/** `pnpm --filter @akinaza/db exec tsx src/gen-account-migration.ts > drizzle/0017_accounts_baseline.sql` */
process.stdout.write(ACCOUNTS_MIGRATION_SQL);
