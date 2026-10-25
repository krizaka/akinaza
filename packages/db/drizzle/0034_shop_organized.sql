-- When a shop received its default tag set (akinaza#337): once, so a tag the owner deletes is not brought back. NULL = not yet; the first
-- visit to Clients or Invoices seeds the administrator's defaults for the shop's trade and language.
ALTER TABLE shops ADD COLUMN organized_at timestamptz;
