import { ROLES_MIGRATION_SQL } from "./roles-migration";

/** `pnpm --filter @akinaza/db exec tsx src/gen-roles-migration.ts > drizzle/0020_shop_roles.sql` */
process.stdout.write(ROLES_MIGRATION_SQL);
