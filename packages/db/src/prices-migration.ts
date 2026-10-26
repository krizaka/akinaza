import { pricesMigration } from "@krizaka/settings";

/**
 * Migration 0035, generated from the shared block (a test fails when the file and the block drift apart): the catalogue of
 * prices (akinaza#371, ADR-009) — its dated versions, each audited — then the version a subscription was sold at, and the
 * retirement of the setting `plans.founder.limit` (the cap is now the Starter entry's `founderCap` limit, one source only).
 */
export const PRICES_MIGRATION_HEADER = "-- The catalogue of prices (@krizaka/settings, akinaza#371): dated versions an administrator schedules, each audited.\n";
export const PRICES_MIGRATION_TAIL = `-- The catalogue's version a subscription was sold at: a founder keeps the founder price, whatever is scheduled later.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS subscription_price_version text;
-- The founder offer's cap moved to the Starter entry (\`founderCap\`): the former setting is retired, never a second source.
-- An override, if one was set, is kept in the audit trail; the administrator re-enters it on the prices page.
INSERT INTO settings_audit (actor_label, scope, scope_id, key, before, after)
  SELECT 'migration 0035', scope, scope_id, key, value, NULL FROM app_settings WHERE key = 'plans.founder.limit';
DELETE FROM app_settings WHERE key = 'plans.founder.limit';
`;
export const PRICES_MIGRATION_SQL = PRICES_MIGRATION_HEADER + pricesMigration().trimStart() + PRICES_MIGRATION_TAIL;
