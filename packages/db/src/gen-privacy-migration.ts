import { PRIVACY_MIGRATION_SQL } from "./privacy-migration";

/** `pnpm --filter @akinaza/db exec tsx src/gen-privacy-migration.ts > drizzle/0037_privacy.sql` */
process.stdout.write(PRIVACY_MIGRATION_SQL);
