import { PRICE_SCHEDULE_SQL } from "./price-schedule";

/** `pnpm --filter @akinaza/db exec tsx src/gen-price-schedule-migration.ts > drizzle/0053_prices_association.sql` */
process.stdout.write(`-- The new price grid as dated catalogue versions, and the Association plan's proof (akinaza ADR-003 addendum 2026-10-30).
${PRICE_SCHEDULE_SQL}
-- The proof an association submits (its NEQ, its registered charity number, or its incorporation document's reference): one pending
-- at a time, decided once by an administrator. Until approved the account is on Starter.
CREATE TABLE association_proofs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('neq','charity','incorporation')),
  reference     text NOT NULL,
  note          text,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  decided_at    timestamptz,
  decided_by    uuid REFERENCES accounts(id) ON DELETE SET NULL,
  decision_note text,
  CONSTRAINT association_proofs_decided CHECK ((status = 'pending') = (decided_at IS NULL))
);
CREATE INDEX association_proofs_account ON association_proofs (account_id, submitted_at);
CREATE UNIQUE INDEX association_proofs_one_pending ON association_proofs (account_id) WHERE status = 'pending';
`);
