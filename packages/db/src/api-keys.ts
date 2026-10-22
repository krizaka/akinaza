import { apiKeysMigration } from "@krizaka/api-keys";

/** Migration 0016 (`api_keys`), generated from the shared block (a test fails when the file and the block drift apart). */
export const API_KEYS_MIGRATION_HEADER = "-- API keys (krizaka/akinaza#178, @krizaka/api-keys): only a SHA-256 of the secret is kept; a rotated-out key lives on until superseded_at.\n";
export const API_KEYS_MIGRATION_SQL = API_KEYS_MIGRATION_HEADER + apiKeysMigration("accounts").trimStart();
