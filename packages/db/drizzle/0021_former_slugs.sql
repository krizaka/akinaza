-- A shop's former page addresses (krizaka/akinaza#77): when a shop changes its slug, the old one keeps leading to it (308)
-- for as long as the shop exists, so printed flyers and QR codes never break. Another shop can never take a former slug
-- (it would capture those links); the same shop may take it back. The database keeps the rule, whoever writes.
CREATE TABLE IF NOT EXISTS shop_former_slugs (
  slug       text PRIMARY KEY CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  shop_id    uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  retired_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_former_slugs_shop ON shop_former_slugs(shop_id);

CREATE FUNCTION ak_shop_slug_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.slug IS NOT NULL AND EXISTS (SELECT 1 FROM shop_former_slugs f WHERE f.slug = NEW.slug AND f.shop_id <> NEW.id) THEN
    RAISE EXCEPTION 'AK_SLUG_TAKEN: % is a former address of another shop', NEW.slug USING ERRCODE = '23505', CONSTRAINT = 'shops_slug';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL AND OLD.slug IS DISTINCT FROM NEW.slug THEN
    INSERT INTO shop_former_slugs (slug, shop_id) VALUES (OLD.slug, NEW.id) ON CONFLICT (slug) DO NOTHING;
  END IF;
  IF NEW.slug IS NOT NULL THEN
    DELETE FROM shop_former_slugs WHERE slug = NEW.slug AND shop_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER shops_slug_history BEFORE INSERT OR UPDATE OF slug ON shops FOR EACH ROW EXECUTE FUNCTION ak_shop_slug_history();
