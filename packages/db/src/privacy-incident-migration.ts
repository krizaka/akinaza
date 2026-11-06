import { emitMigration } from "@krizaka/db";
import { privacySchema } from "@krizaka/privacy";

/**
 * Migration 0043, generated (a test fails when the file and this text drift apart): `@krizaka/privacy` v2, the Law 25 confidentiality
 * incident register (folioviv#392) in the `privacy` schema. One `scope` per tenant: Folioviv's register is the company's, scope `folioviv`.
 */
export const PRIVACY_INCIDENT_MIGRATION_HEADER = "-- Confidentiality incident register (@krizaka/privacy v2, folioviv#392): Law 25, ss. 3.5 to 3.8. Kept five years; a closed entry is never edited.\n";

export const PRIVACY_INCIDENT_MIGRATION_SQL = PRIVACY_INCIDENT_MIGRATION_HEADER + emitMigration(privacySchema, 2, { tables: {} }).trimStart();
