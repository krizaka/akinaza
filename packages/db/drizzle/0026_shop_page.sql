-- An optional per-shop storefront layout; no row means the current default layout.
CREATE TABLE shop_page (
  shop_id uuid PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
  sections jsonb NOT NULL DEFAULT '[{"id":"services","visible":true},{"id":"team","visible":true},{"id":"hours","visible":true},{"id":"zones","visible":true},{"id":"gallery","visible":true},{"id":"wall","visible":true},{"id":"reels","visible":true},{"id":"announcements","visible":true},{"id":"reviews","visible":true},{"id":"follow","visible":true}]'::jsonb,
  logo_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shop_page_logo_https CHECK (logo_url IS NULL OR (logo_url LIKE 'https://%' AND length(logo_url) <= 500))
);
