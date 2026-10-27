-- The owner's own thresholds for their figures (akinaza#260): only the keys the owner changed, whole numbers; no row = the administrator's defaults.
-- The bounds of each key are the application's (OWNER_BOUNDS in @akinaza/core); the database holds the shape and the tenant.
CREATE TABLE shop_figure_rules (
  shop_id uuid PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
  overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shop_figure_rules_object CHECK (jsonb_typeof(overrides) = 'object')
);
