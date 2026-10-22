-- The Monday brief's actions (krizaka/akinaza#200): one row per recommendation acted on, so a button pressed twice never
-- sends twice (the recommendation id is stable for its week: `<week>:<kind>:<subject>`), and the next brief can say what
-- the action brought.
CREATE TABLE IF NOT EXISTS brief_actions (
  shop_id           uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  recommendation_id text NOT NULL CHECK (recommendation_id ~ '^\d{4}-W\d{2}:[a-z]+:[A-Za-z0-9-]+$'),
  kind              text NOT NULL CHECK (kind IN ('invite', 'price', 'taxes')),
  result            jsonb NOT NULL DEFAULT '{}'::jsonb,
  done_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shop_id, recommendation_id)
);
