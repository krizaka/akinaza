-- The paper under the shop's public page (akinaza#305): one of the four of the notebook (plain, seyes, kraft, washi), null = the look's own.
-- Applying a template sets it to the template's paper; the owner never types it.
ALTER TABLE shop_page ADD COLUMN paper text;
ALTER TABLE shop_page ADD CONSTRAINT shop_page_paper CHECK (paper IS NULL OR paper IN ('plain','seyes','kraft','washi'));
