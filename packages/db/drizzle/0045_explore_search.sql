-- Explorer's search (akinaza#574, ADR-006): a read model of the published shops that one indexed query reads, kept in step by
-- triggers (every writer, in the same transaction). Only trusted extensions: `earthdistance` is not one, so the position is
-- a core `point` with a GiST index and the distance is computed (haversine) on the few shops the box lets through.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE FUNCTION f_unaccent(text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

CREATE TABLE shop_search (
  shop_id uuid PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  name_norm text NOT NULL,
  kind text NOT NULL,
  area text,
  tagline_fr text,
  tagline_en text,
  timezone text NOT NULL,
  quartiers text[] NOT NULL DEFAULT '{}',
  lat double precision,
  lng double precision,
  pt point GENERATED ALWAYS AS (CASE WHEN lat IS NOT NULL AND lng IS NOT NULL THEN point(lng, lat) END) STORED,
  search tsvector NOT NULL
);
CREATE INDEX shop_search_fts ON shop_search USING gin (search);
CREATE INDEX shop_search_name_trgm ON shop_search USING gin (name_norm gin_trgm_ops);
CREATE INDEX shop_search_pt ON shop_search USING gist (pt);
CREATE INDEX shop_search_kind ON shop_search (kind);
-- The list order (name, then id): a page is read off the index, not sorted.
CREATE INDEX shop_search_order ON shop_search (name, shop_id);

-- The hours the open-now and open-this-week filters read, per shop and per person (no index existed on either side of the join).
CREATE INDEX schedules_staff_weekday ON schedules (staff_id, weekday);
CREATE INDEX staff_shop ON staff (shop_id) WHERE active;

CREATE FUNCTION refresh_shop_search(p_shop uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM shop_search WHERE shop_id = p_shop
    AND NOT EXISTS (SELECT 1 FROM shops WHERE id = p_shop AND published AND slug IS NOT NULL);
  INSERT INTO shop_search (shop_id, slug, name, name_norm, kind, area, tagline_fr, tagline_en, timezone, quartiers, lat, lng, search)
  SELECT s.id, s.slug, s.name, f_unaccent(lower(s.name)), s.kind, s.area, s.tagline_fr, s.tagline_en, s.timezone,
         COALESCE(z.names, '{}'), z.lat, z.lng,
         to_tsvector('simple', f_unaccent(concat_ws(' ', s.name, s.area, s.tagline_fr, s.tagline_en, array_to_string(z.names, ' '), v.names)))
  FROM shops s
  LEFT JOIN LATERAL (
    SELECT array_agg(name ORDER BY position, name) AS names,
           (array_agg(lat ORDER BY position, name) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL))[1] AS lat,
           (array_agg(lng ORDER BY position, name) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL))[1] AS lng
    FROM shop_zones WHERE shop_id = s.id AND active) z ON true
  LEFT JOIN LATERAL (SELECT string_agg(name_fr || ' ' || name_en, ' ') AS names FROM services WHERE shop_id = s.id AND active) v ON true
  WHERE s.id = p_shop AND s.published AND s.slug IS NOT NULL
  ON CONFLICT (shop_id) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name, name_norm = EXCLUDED.name_norm, kind = EXCLUDED.kind,
    area = EXCLUDED.area, tagline_fr = EXCLUDED.tagline_fr, tagline_en = EXCLUDED.tagline_en, timezone = EXCLUDED.timezone,
    quartiers = EXCLUDED.quartiers, lat = EXCLUDED.lat, lng = EXCLUDED.lng, search = EXCLUDED.search;
END $$;

CREATE FUNCTION shop_search_of_shop() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM refresh_shop_search(NEW.id); RETURN NULL; END $$;
CREATE FUNCTION shop_search_of_child() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM refresh_shop_search(COALESCE(NEW.shop_id, OLD.shop_id)); RETURN NULL; END $$;

-- The columns that feed the read model only: an invoice number moving does not refresh it.
CREATE TRIGGER shop_search_shop_ins AFTER INSERT ON shops FOR EACH ROW EXECUTE FUNCTION shop_search_of_shop();
CREATE TRIGGER shop_search_shop_upd AFTER UPDATE OF name, kind, area, tagline_fr, tagline_en, timezone, slug, published ON shops
  FOR EACH ROW EXECUTE FUNCTION shop_search_of_shop();
CREATE TRIGGER shop_search_zones AFTER INSERT OR UPDATE OR DELETE ON shop_zones FOR EACH ROW EXECUTE FUNCTION shop_search_of_child();
CREATE TRIGGER shop_search_services AFTER INSERT OR UPDATE OR DELETE ON services FOR EACH ROW EXECUTE FUNCTION shop_search_of_child();

SELECT refresh_shop_search(id) FROM shops WHERE published AND slug IS NOT NULL;
