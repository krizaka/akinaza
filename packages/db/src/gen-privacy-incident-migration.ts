import { PRIVACY_INCIDENT_MIGRATION_SQL } from "./privacy-incident-migration";

/** `pnpm --filter @akinaza/db exec tsx src/gen-privacy-incident-migration.ts > drizzle/0043_privacy_incident_register.sql` */
process.stdout.write(PRIVACY_INCIDENT_MIGRATION_SQL);
