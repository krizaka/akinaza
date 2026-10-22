import { SETTINGS_MIGRATION_SQL } from "./settings-migration";

/** `pnpm --filter @akinaza/db exec tsx src/gen-settings-migration.ts > drizzle/0018_settings.sql` */
process.stdout.write(SETTINGS_MIGRATION_SQL);
