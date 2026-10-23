-- Tenant isolation audit (#247): every table that carries a shop_id is indexed by it, so a query scoped to one shop never scans the others.
CREATE INDEX IF NOT EXISTS services_shop ON services (shop_id);
CREATE INDEX IF NOT EXISTS expenses_shop ON expenses (shop_id, paid_on);
CREATE INDEX IF NOT EXISTS dependants_shop ON dependants (shop_id);
