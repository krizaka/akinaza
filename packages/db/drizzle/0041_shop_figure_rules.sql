-- Renumbered from 0038/0039 when main took those numbers for the shop page; idempotent because the dev database already holds these tables. 0040 keeps its number and content.
-- The owner's own thresholds for their figures (akinaza#260): only the keys the owner changed, whole numbers; no row = the administrator's defaults.
-- The bounds of each key are the application's (OWNER_BOUNDS in @akinaza/core); the database holds the shape and the tenant.
CREATE TABLE IF NOT EXISTS shop_figure_rules (
  shop_id uuid PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
  overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shop_figure_rules_object CHECK (jsonb_typeof(overrides) = 'object')
);
