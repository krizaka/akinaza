-- The private calendar feeds (akinaza#282, ADR-004): one active token per shop and per staff member; only the keyed hash of the token is stored.
CREATE TABLE feed_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES staff(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT feed_tokens_hash_shape CHECK (token_hash ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX feed_tokens_hash ON feed_tokens (token_hash);
CREATE INDEX feed_tokens_shop ON feed_tokens (shop_id);
-- At most one live token per feed: a rotation that races another cannot leave two URLs open.
CREATE UNIQUE INDEX feed_tokens_active_shop ON feed_tokens (shop_id) WHERE staff_id IS NULL AND revoked_at IS NULL;
CREATE UNIQUE INDEX feed_tokens_active_staff ON feed_tokens (shop_id, staff_id) WHERE staff_id IS NOT NULL AND revoked_at IS NULL;
