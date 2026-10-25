-- Signed notes on a client file (D5, #332): who wrote it (the account, and the name it showed then), when, the words. The shop's
-- own (shop_id leads the index, tenancy.ts); erasing the client (Loi 25) deletes them (eraseClient).
CREATE TABLE client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  author_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_notes_body CHECK (length(btrim(body)) BETWEEN 1 AND 2000)
);
--> statement-breakpoint
CREATE INDEX client_notes_shop_client ON client_notes (shop_id, client_id, created_at);
