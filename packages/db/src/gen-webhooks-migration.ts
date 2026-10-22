import { WEBHOOKS_MIGRATION_SQL } from "./webhooks-migration";

/** `pnpm --filter @akinaza/db exec tsx src/gen-webhooks-migration.ts > drizzle/0019_webhooks.sql` */
process.stdout.write(WEBHOOKS_MIGRATION_SQL);
