ALTER TABLE shops
  ADD COLUMN invoice_mail_message text NOT NULL DEFAULT '',
  ADD COLUMN invoice_mail_from_name text,
  ADD COLUMN invoice_mail_copy boolean NOT NULL DEFAULT false,
  ADD COLUMN invoice_link_days integer NOT NULL DEFAULT 30,
  ADD CONSTRAINT shops_invoice_link_days CHECK (invoice_link_days BETWEEN 1 AND 365),
  ADD CONSTRAINT shops_invoice_mail_message CHECK (length(invoice_mail_message) <= 500),
  ADD CONSTRAINT shops_invoice_mail_from_name CHECK (invoice_mail_from_name IS NULL OR length(invoice_mail_from_name) BETWEEN 1 AND 120);

ALTER TABLE mail_outbox
  ADD COLUMN cc_email text,
  ADD COLUMN from_name text;

CREATE TABLE invoice_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  view_token_hash text NOT NULL UNIQUE,
  to_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  opened_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX invoice_deliveries_invoice ON invoice_deliveries(invoice_id, created_at);
