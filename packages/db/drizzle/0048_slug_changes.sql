-- The pace of address changes (ADR-005 slice 4, akinaza#537): each change of a shop's slug is recorded, and the service refuses more than the
-- administrator's bound in a window (AK_SLUG_RATE_LIMIT). Former slugs stay locked for the shop (0021): this only limits how fast a shop moves.
CREATE TABLE shop_slug_changes (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shop_slug_changes_shop_at ON shop_slug_changes (shop_id, at);
