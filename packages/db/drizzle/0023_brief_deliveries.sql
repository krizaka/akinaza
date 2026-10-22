-- The Monday brief by e-mail (krizaka/akinaza#200): at most one per shop and week, whoever sends (several instances race
-- on the primary key, one wins); the owner turns it off in one click (a random token, only its SHA-256 kept).
ALTER TABLE shops ADD COLUMN IF NOT EXISTS brief_email boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS brief_deliveries (
  shop_id            uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  week               text NOT NULL CHECK (week ~ '^\d{4}-W\d{2}$'),
  items              integer NOT NULL DEFAULT 0 CHECK (items BETWEEN 0 AND 3),
  unsubscribe_sha256 text CHECK (unsubscribe_sha256 IS NULL OR unsubscribe_sha256 ~ '^[0-9a-f]{64}$'),
  sent_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shop_id, week)
);
CREATE INDEX IF NOT EXISTS brief_deliveries_unsubscribe ON brief_deliveries(unsubscribe_sha256) WHERE unsubscribe_sha256 IS NOT NULL;
