-- The offers on a shop's page (akinaza#597): the owner's order, a link to where the offer lives (a product's own site), and a logo for the dark theme.
-- The old order (shortest, then name) becomes the first positions.
ALTER TABLE services ADD COLUMN position integer NOT NULL DEFAULT 0;
UPDATE services s SET position = o.rank FROM (SELECT id, row_number() OVER (PARTITION BY shop_id ORDER BY duration_minutes, name_en, id) - 1 AS rank FROM services) o WHERE o.id = s.id;
ALTER TABLE services ADD COLUMN link_url text;
ALTER TABLE services ADD CONSTRAINT services_link_https CHECK (link_url IS NULL OR (link_url LIKE 'https://%' AND length(link_url) <= 500));
ALTER TABLE shop_page ADD COLUMN logo_dark_url text;
ALTER TABLE shop_page ADD CONSTRAINT shop_page_logo_dark_https CHECK (logo_dark_url IS NULL OR (logo_dark_url LIKE 'https://%' AND length(logo_dark_url) <= 500));
