-- The default images and videos of a storefront (#267): the shop type the owner chose (the type of its trade, which picks its defaults) and whether the page
-- shows the proposed images where the owner has none. NULL type = derived from the business type; true = shown.
ALTER TABLE shop_page
  ADD COLUMN shop_type text,
  ADD COLUMN use_defaults boolean NOT NULL DEFAULT true,
  ADD CONSTRAINT shop_page_shop_type CHECK (shop_type IS NULL OR shop_type IN ('salon','coaching','workshop','cleaning','pets','consulting'));
