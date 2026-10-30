-- Anti-phishing shop addresses (ADR-005 slice 4, akinaza#537): a slug wearing a protected term (a brand, a lure word, a look-alike) is HELD.
-- The shop is saved but is not public (page, map, booking, feed) until the administrator clears it. The term that matched is kept for the review.
ALTER TABLE shops ADD COLUMN slug_held boolean NOT NULL DEFAULT false;
ALTER TABLE shops ADD COLUMN slug_held_term text;
ALTER TABLE shops ADD COLUMN slug_held_at timestamptz;
ALTER TABLE shops ADD CONSTRAINT shops_held_has_slug CHECK (NOT slug_held OR slug IS NOT NULL);
CREATE INDEX shops_slug_held ON shops (slug_held_at) WHERE slug_held;

CREATE OR REPLACE FUNCTION refresh_shop_search(p_shop uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM shop_search WHERE shop_id = p_shop
    AND NOT EXISTS (SELECT 1 FROM shops WHERE id = p_shop AND published AND NOT slug_held AND slug IS NOT NULL);
  INSERT INTO shop_search (shop_id, kind, timezone, slug, name, name_norm, area, tagline_en, tagline_fr, quartiers, lat, lng, search)
  SELECT s.id, s.kind, s.timezone, s.slug, s.name, f_unaccent(lower(s.name)), s.area, s.tagline_en, s.tagline_fr,
         COALESCE(z.names, '{}'), z.lat, z.lng,
         to_tsvector('simple', f_unaccent(concat_ws(' ', s.name, s.area, s.tagline_fr, s.tagline_en, array_to_string(z.names, ' '), v.names)))
  FROM shops s
  LEFT JOIN LATERAL (
    SELECT array_agg(name ORDER BY position, name) AS names,
           (array_agg(lat ORDER BY position, name) FILTER (WHERE NOT (lat IS NULL OR lng IS NULL)))[1] AS lat,
           (array_agg(lng ORDER BY position, name) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL))[1] AS lng
    FROM shop_zones WHERE shop_id = s.id AND active) z ON true
  LEFT JOIN LATERAL (SELECT string_agg(name_fr || ' ' || name_en, ' ') AS names FROM services WHERE shop_id = s.id AND active) v ON true
  WHERE s.id = p_shop AND s.published AND NOT s.slug_held AND s.slug IS NOT NULL
  ON CONFLICT (shop_id) DO UPDATE SET kind = EXCLUDED.kind, timezone = EXCLUDED.timezone, slug = EXCLUDED.slug, name = EXCLUDED.name,
    name_norm = EXCLUDED.name_norm, area = EXCLUDED.area, tagline_en = EXCLUDED.tagline_en, tagline_fr = EXCLUDED.tagline_fr,
    search = EXCLUDED.search, quartiers = EXCLUDED.quartiers, lat = EXCLUDED.lat, lng = EXCLUDED.lng;
END $$;

-- A held slug leaves the Explorer read model at once and comes back when cleared (the read model lists public shops only).
DROP TRIGGER shop_search_shop_upd ON shops;
CREATE TRIGGER shop_search_shop_upd AFTER UPDATE OF name, kind, area, tagline_fr, tagline_en, timezone, slug, published, slug_held ON shops
  FOR EACH ROW EXECUTE FUNCTION shop_search_of_shop();

SELECT refresh_shop_search(id) FROM shops WHERE published AND NOT slug_held AND slug IS NOT NULL;
