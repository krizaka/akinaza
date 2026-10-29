-- Anti-phishing shop addresses (ADR-005 slice 4, akinaza#537): a slug wearing a protected term (a brand, a lure word, a look-alike) is HELD.
-- The shop is saved but is not public (page, map, booking, feed) until the administrator clears it. The term that matched is kept for the review.
ALTER TABLE shops ADD COLUMN slug_held boolean NOT NULL DEFAULT false;
ALTER TABLE shops ADD COLUMN slug_held_term text;
ALTER TABLE shops ADD COLUMN slug_held_at timestamptz;
ALTER TABLE shops ADD CONSTRAINT shops_held_has_slug CHECK (NOT slug_held OR slug IS NOT NULL);
CREATE INDEX shops_slug_held ON shops (slug_held_at) WHERE slug_held;
