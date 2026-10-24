-- The template of a storefront (#261): the one the owner applied (id and version, kept when the template improves), whether the owner has
-- reordered or hidden sections by hand (so a template never replaces that without asking), and the owner's text-style overrides.
-- No template_id = today's page, always. shop_type is owned by 0030 (#267) and is not touched here.
ALTER TABLE shop_page
  ADD COLUMN template_id text,
  ADD COLUMN template_version integer,
  ADD COLUMN sections_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN style jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT shop_page_template_pair CHECK ((template_id IS NULL) = (template_version IS NULL) AND (template_version IS NULL OR template_version >= 1)),
  ADD CONSTRAINT shop_page_template_id CHECK (template_id IS NULL OR template_id ~ '^[a-z]+-[a-z]+$');

-- Pages saved before templates existed: the owner's own order and visibility (#237) are what differs from the default sections.
UPDATE shop_page
   SET sections_custom = true
 WHERE sections IS DISTINCT FROM '[{"id":"services","visible":true},{"id":"team","visible":true},{"id":"hours","visible":true},{"id":"zones","visible":true},{"id":"gallery","visible":true},{"id":"wall","visible":true},{"id":"reels","visible":true},{"id":"announcements","visible":true},{"id":"reviews","visible":true},{"id":"follow","visible":true}]'::jsonb;
