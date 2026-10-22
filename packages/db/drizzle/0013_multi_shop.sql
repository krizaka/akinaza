-- An owner may run several shops (krizaka/akinaza multi-shop). Exactly one is the one the app opens on: the default.
-- The database keeps it: one per owner (an exclusion checked at the end of the statement, so the default can move in one UPDATE),
-- and a shop created for an owner who has none becomes it.
ALTER TABLE "shops" ADD COLUMN "is_default" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
UPDATE "shops" s SET "is_default" = true
WHERE s."owner_id" IS NOT NULL
  AND s."id" = (SELECT f."id" FROM "shops" f WHERE f."owner_id" = s."owner_id" ORDER BY f."created_at", f."id" LIMIT 1);
--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_one_default_per_owner" EXCLUDE USING btree ("owner_id" WITH =) WHERE ("is_default") DEFERRABLE INITIALLY IMMEDIATE;
--> statement-breakpoint
CREATE FUNCTION ak_shop_default() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM shops WHERE owner_id = NEW.owner_id AND is_default) THEN
    NEW.is_default := true;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER ak_shop_default BEFORE INSERT ON "shops" FOR EACH ROW EXECUTE FUNCTION ak_shop_default();
