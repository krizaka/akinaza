-- The accent the owner chose within the shop page's look (akinaza#402): one of the preset's tested accents, null = the look's own.
ALTER TABLE shop_page ADD COLUMN accent text;
ALTER TABLE shop_page ADD CONSTRAINT shop_page_accent CHECK (accent IS NULL OR accent ~ '^[a-z0-9:-]{1,40}$');
