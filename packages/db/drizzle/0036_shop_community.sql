-- The shop as a place (akinaza#236, B45): the wall, the reels, the profile links, the reviews and the bulletin board of the public page.
-- Every table carries shop_id (tenancy.ts); the bounds the application checks are the database's too.
CREATE TABLE shop_wall (
  shop_id uuid PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
  texture text NOT NULL DEFAULT 'plaster',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shop_wall_texture CHECK (texture IN ('brick','zellige','ridge','plaster'))
);

CREATE TABLE shop_wall_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  kind text NOT NULL,
  x double precision NOT NULL,
  y double precision NOT NULL,
  rotation double precision NOT NULL DEFAULT 0,
  z integer NOT NULL DEFAULT 0,
  attachment text NOT NULL DEFAULT 'tape',
  variant text,
  image_url text,
  alt_fr text NOT NULL DEFAULT '',
  alt_en text NOT NULL DEFAULT '',
  caption_fr text NOT NULL DEFAULT '',
  caption_en text NOT NULL DEFAULT '',
  text_fr text NOT NULL DEFAULT '',
  text_en text NOT NULL DEFAULT '',
  signature text NOT NULL DEFAULT '',
  CONSTRAINT shop_wall_items_kind CHECK (kind IN ('polaroid','note','sign')),
  CONSTRAINT shop_wall_items_attachment CHECK (attachment IN ('tape','pin')),
  CONSTRAINT shop_wall_items_variant CHECK (variant IS NULL OR variant IN ('enamel','neon','painted')),
  CONSTRAINT shop_wall_items_place CHECK (x BETWEEN 0 AND 100 AND y BETWEEN 0 AND 100 AND rotation BETWEEN -8 AND 8 AND z BETWEEN 0 AND 1000),
  CONSTRAINT shop_wall_items_texts CHECK (length(caption_fr) <= 40 AND length(caption_en) <= 40 AND length(text_fr) <= 140 AND length(text_en) <= 140 AND length(signature) <= 40 AND length(alt_fr) <= 200 AND length(alt_en) <= 200),
  CONSTRAINT shop_wall_items_image CHECK (image_url IS NULL OR (image_url LIKE 'https://%' AND length(image_url) <= 500))
);
CREATE INDEX shop_wall_items_shop ON shop_wall_items (shop_id, z);

CREATE TABLE shop_reels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  kind text NOT NULL,
  mp4_url text,
  webm_url text,
  poster_url text,
  seconds double precision,
  platform text,
  external_url text,
  embed_url text,
  title_fr text NOT NULL DEFAULT '',
  title_en text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shop_reels_platform CHECK (platform IS NULL OR platform IN ('tiktok','youtube-shorts','instagram')),
  CONSTRAINT shop_reels_kind CHECK ((kind = 'upload' AND (mp4_url IS NOT NULL OR webm_url IS NOT NULL) AND platform IS NULL) OR (kind = 'external' AND platform IS NOT NULL AND external_url IS NOT NULL AND embed_url IS NOT NULL)),
  CONSTRAINT shop_reels_urls CHECK (coalesce(mp4_url, 'https://') ~ '^https://' AND coalesce(webm_url, 'https://') ~ '^https://' AND coalesce(poster_url, 'https://') ~ '^https://' AND coalesce(external_url, 'https://') ~ '^https://' AND coalesce(embed_url, 'https://') ~ '^https://'),
  CONSTRAINT shop_reels_titles CHECK (length(title_fr) <= 60 AND length(title_en) <= 60)
);
CREATE INDEX shop_reels_shop ON shop_reels (shop_id, created_at);

CREATE TABLE shop_social_links (
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  platform text NOT NULL,
  url text NOT NULL,
  PRIMARY KEY (shop_id, platform),
  CONSTRAINT shop_social_links_url CHECK (url LIKE 'https://%' AND length(url) <= 300),
  CONSTRAINT shop_social_links_platform CHECK (platform IN ('tiktok','youtube','instagram','facebook'))
);

CREATE TABLE shop_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_initial text NOT NULL DEFAULT '',
  rating smallint NOT NULL,
  body text NOT NULL DEFAULT '',
  service_name text NOT NULL DEFAULT '',
  verified boolean NOT NULL DEFAULT false,
  state text NOT NULL DEFAULT 'published',
  reply text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shop_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT shop_reviews_state CHECK (state IN ('published','hidden_by_owner','removed_by_admin','pending')),
  CONSTRAINT shop_reviews_texts CHECK (length(body) <= 1000 AND length(reply) <= 1000 AND length(first_name) <= 40 AND length(last_initial) <= 2 AND length(service_name) <= 120)
);
CREATE INDEX shop_reviews_shop ON shop_reviews (shop_id, created_at);
CREATE UNIQUE INDEX shop_reviews_one_per_client ON shop_reviews (shop_id, client_id) WHERE client_id IS NOT NULL;

CREATE TABLE shop_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  text_fr text NOT NULL DEFAULT '',
  text_en text NOT NULL DEFAULT '',
  photo_url text,
  photo_alt text NOT NULL DEFAULT '',
  ends_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shop_announcements_text CHECK (length(text_fr) <= 500 AND length(text_en) <= 500 AND length(text_fr) + length(text_en) > 0 AND length(photo_alt) <= 200),
  CONSTRAINT shop_announcements_photo CHECK (photo_url IS NULL OR (photo_url LIKE 'https://%' AND length(photo_url) <= 500))
);
CREATE INDEX shop_announcements_shop ON shop_announcements (shop_id, created_at);
