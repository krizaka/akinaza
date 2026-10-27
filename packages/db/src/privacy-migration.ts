import { emitMigration } from "@krizaka/db";
import { privacySchema } from "@krizaka/privacy";

/**
 * Migration 0037, generated (a test fails when the file and this text drift apart): the shared module's tables in the `privacy` schema
 * (`@krizaka/privacy` v1: consents written once, the record of each export and erasure), then the shop clients' consents moved into
 * it - subject `client`, the client file's id - and the old table dropped. One source of truth for a consent.
 */
export const PRIVACY_MIGRATION_HEADER = "-- Privacy (@krizaka/privacy, akinaza#370): consents by purpose written once, the record of exports and erasures. The clients' consents move here.\n";

export const PRIVACY_MIGRATION_BACKFILL = `
-- The decisions made so far, in their order: the sequence keeps the last word of each purpose where it was.
INSERT INTO privacy.consent (id, subject_kind, subject_id, purpose, version, granted, means, at)
SELECT gen_random_uuid(), 'client', client_id::text, purpose, text_version, granted, 'migrated', at FROM client_consents ORDER BY id;
DROP TABLE client_consents;
`;

export const PRIVACY_MIGRATION_SQL = PRIVACY_MIGRATION_HEADER + emitMigration(privacySchema, 1, { tables: {} }).trimStart() + PRIVACY_MIGRATION_BACKFILL;
