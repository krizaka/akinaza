-- Shops are items of « organize » (@krizaka/organize, ADR-006): collections, tags, and a description, an avatar and a collection on every shop.
-- Generated from `src/organize.ts` — a test fails when this file and the declaration drift apart. Never edit by hand.

CREATE TABLE collections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  description text CHECK (description IS NULL OR length(description) <= 500),
  avatar      jsonb CHECK (avatar IS NULL OR (jsonb_typeof(avatar) = 'object' AND avatar->>'kind' IN ('set', 'image'))),
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, name),
  CONSTRAINT collections_one_default EXCLUDE USING btree (owner_id WITH =) WHERE (is_default) DEFERRABLE INITIALLY IMMEDIATE
);
CREATE TABLE tags (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name     text NOT NULL,
  color    text NOT NULL CHECK (color IN ('blue', 'green', 'amber', 'red', 'violet', 'gray'))
);
CREATE UNIQUE INDEX tags_owner_name ON tags(owner_id, lower(name));
CREATE TABLE collections_tags (collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE, tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (collection_id, tag_id));


ALTER TABLE shops ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS avatar jsonb;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS collection_id uuid REFERENCES collections(id);
CREATE INDEX IF NOT EXISTS shops_collection ON shops(collection_id);
CREATE TABLE shop_tags (shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE, tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (shop_id, tag_id));


CREATE FUNCTION collections_create_default(p_owner uuid, p_locale text) RETURNS uuid AS $$
DECLARE col uuid; base text := CASE p_locale WHEN 'fr' THEN 'Mes commerces' ELSE 'My shops' END; candidate text := base; n int := 1;
BEGIN
  WHILE EXISTS (SELECT 1 FROM collections WHERE owner_id = p_owner AND name = candidate) LOOP n := n + 1; candidate := base || ' ' || n; END LOOP;
  INSERT INTO collections (owner_id, name, is_default) VALUES (p_owner, candidate, true) RETURNING id INTO col;
  RETURN col;
END $$ LANGUAGE plpgsql;

CREATE FUNCTION collections_owner_default() RETURNS trigger AS $$
BEGIN PERFORM collections_create_default(NEW.id, NEW.locale); RETURN NEW; END $$ LANGUAGE plpgsql;
CREATE TRIGGER collections_owner_default AFTER INSERT ON accounts FOR EACH ROW EXECUTE FUNCTION collections_owner_default();

CREATE FUNCTION collections_guard_default() RETURNS trigger AS $$
BEGIN
  IF OLD.is_default AND EXISTS (SELECT 1 FROM accounts WHERE id = OLD.owner_id) THEN RAISE EXCEPTION 'DEFAULT_COLLECTION: the default collection cannot be deleted'; END IF;
  RETURN OLD;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER collections_guard_default BEFORE DELETE ON collections FOR EACH ROW EXECUTE FUNCTION collections_guard_default();

CREATE FUNCTION collections_exactly_one_default() RETURNS trigger AS $$
DECLARE o uuid := COALESCE(NEW.owner_id, OLD.owner_id);
BEGIN
  IF EXISTS (SELECT 1 FROM accounts WHERE id = o) AND (SELECT count(*) FROM collections WHERE owner_id = o AND is_default) <> 1 THEN RAISE EXCEPTION 'DEFAULT_COLLECTION: an owner has exactly one default collection'; END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER collections_exactly_one_default AFTER INSERT OR UPDATE OR DELETE ON collections DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION collections_exactly_one_default();


CREATE FUNCTION shops_default_collection() RETURNS trigger AS $$
BEGIN
  IF NEW.collection_id IS NULL THEN SELECT id INTO NEW.collection_id FROM collections WHERE owner_id = NEW.owner_id AND is_default; END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER shops_default_collection BEFORE INSERT OR UPDATE OF collection_id ON shops FOR EACH ROW WHEN (NEW.collection_id IS NULL) EXECUTE FUNCTION shops_default_collection();

SELECT collections_create_default(o.id, o.locale) FROM accounts o WHERE NOT EXISTS (SELECT 1 FROM collections x WHERE x.owner_id = o.id AND x.is_default);
UPDATE shops e SET collection_id = x.id FROM collections x WHERE e.collection_id IS NULL AND x.owner_id = e.owner_id AND x.is_default;
