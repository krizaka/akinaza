import { API_KEYS_MIGRATION_SQL } from "./api-keys";

/** `pnpm --filter @akinaza/db exec tsx src/gen-api-keys-migration.ts > drizzle/0016_api_keys.sql` */
process.stdout.write(API_KEYS_MIGRATION_SQL);
