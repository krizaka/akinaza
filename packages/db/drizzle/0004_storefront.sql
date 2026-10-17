-- The storefront (a shop's public page that sells): the shop's locality, bio and public contact, the services' sentence,
-- inclusions and « from » price, the zones' position (for the map) and the shop's photos and loops (cover and gallery).
-- All optional: a shop without them still renders a designed page.

ALTER TABLE "shops" ADD COLUMN "area" text;
--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "bio_fr" text;
--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "bio_en" text;
--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "public_phone" text;
--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "public_email" text;
--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "seat_unit_fr" text;
--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "seat_unit_en" text;
--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_public_text" CHECK (length(coalesce("area", '')) <= 80 AND length(coalesce("bio_fr", '')) <= 600 AND length(coalesce("bio_en", '')) <= 600 AND length(coalesce("public_phone", '')) <= 40 AND length(coalesce("public_email", '')) <= 120 AND length(coalesce("seat_unit_fr", '')) <= 30 AND length(coalesce("seat_unit_en", '')) <= 30);
--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "description_fr" text;
--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "description_en" text;
--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "included_fr" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "included_en" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "price_varies" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_zones" ADD COLUMN "lat" double precision;
--> statement-breakpoint
ALTER TABLE "shop_zones" ADD COLUMN "lng" double precision;
--> statement-breakpoint
ALTER TABLE "shop_zones" ADD CONSTRAINT "shop_zones_position" CHECK (("lat" IS NULL) = ("lng" IS NULL) AND ("lat" IS NULL OR ("lat" BETWEEN -90 AND 90 AND "lng" BETWEEN -180 AND 180)));
--> statement-breakpoint
CREATE TABLE "shop_media" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "shop_id" uuid NOT NULL REFERENCES "shops"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "url" text NOT NULL,
  "webm_url" text,
  "mp4_url" text,
  "alt_fr" text DEFAULT '' NOT NULL,
  "alt_en" text DEFAULT '' NOT NULL,
  "caption_fr" text,
  "caption_en" text,
  "wide" boolean DEFAULT false NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "shop_media_role" CHECK ("role" IN ('cover','gallery')),
  CONSTRAINT "shop_media_urls" CHECK ("url" ~ '^https://' AND coalesce("webm_url", 'https://') ~ '^https://' AND coalesce("mp4_url", 'https://') ~ '^https://')
);
--> statement-breakpoint
CREATE INDEX "shop_media_shop" ON "shop_media" ("shop_id", "role", "position");
--> statement-breakpoint
CREATE UNIQUE INDEX "shop_media_one_cover" ON "shop_media" ("shop_id") WHERE "role" = 'cover';
