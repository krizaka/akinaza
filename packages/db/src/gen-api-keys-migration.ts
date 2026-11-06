import { API_KEYS_MIGRATION_SQL } from "./api-keys";

/** `pnpm --filter @folioviv/db exec tsx src/gen-api-keys-migration.ts > drizzle/0016_api_keys.sql` */
process.stdout.write(API_KEYS_MIGRATION_SQL);
