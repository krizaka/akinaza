-- The shop's short videos are a playlist in the owner's order (akinaza#469): a position per reel (the old order, newest first, becomes the first positions)
-- and the transition between two videos, one of three on the page.
ALTER TABLE shop_reels ADD COLUMN position integer;
UPDATE shop_reels r SET position = o.rank FROM (SELECT id, row_number() OVER (PARTITION BY shop_id ORDER BY created_at DESC, id DESC) - 1 AS rank FROM shop_reels) o WHERE o.id = r.id;
ALTER TABLE shop_reels ALTER COLUMN position SET NOT NULL;
ALTER TABLE shop_reels ADD CONSTRAINT shop_reels_position CHECK (position >= 0 AND position < 100);
ALTER TABLE shops ADD COLUMN reel_transition text NOT NULL DEFAULT 'channel';
ALTER TABLE shops ADD CONSTRAINT shops_reel_transition CHECK (reel_transition IN ('channel','crossfade','slide'));
