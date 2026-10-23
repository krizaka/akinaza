-- « Modifier la facture » (krizaka/akinaza#207): an issued invoice never changes; a correction is its credit note and a
-- replacement issued in the same transaction. The replacement names what it replaces, at insert (the invoice is written
-- once); an invoice is replaced at most once.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS replaces uuid REFERENCES invoices(id);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_replaced_once ON invoices(replaces) WHERE replaces IS NOT NULL;
