-- The new price grid as dated catalogue versions, and the Association plan's proof (akinaza ADR-003 addendum 2026-10-30).
-- The new price grid, as dated versions of the catalogue (akinaza ADR-003 addendum 2026-10-30): the seed is never rewritten, so a subscriber keeps the version it was sold at.
INSERT INTO price_versions (key, price, before, effective_from, created_at, actor_label)
SELECT v.key, b.price || v.patch || jsonb_build_object('limits', (b.price -> 'limits') || v.limits), b.price, now(), now(), v.label
FROM (VALUES
  ('akinaza.starter', '{"unit":"month","amountCents":4500,"availability":"public","limits":{"cardFeeBps":0,"directDebitBps":50,"directDebitCapCents":1500},"currency":"CAD","taxes":"plus-taxes"}'::jsonb, '{"amountCents":2900}'::jsonb, '{"trialDays":90}'::jsonb, 'migration prices-2026-10'),
  ('akinaza.scale', '{"unit":"month","amountCents":9900,"availability":"public","limits":{"cardFeeBps":0,"directDebitBps":25,"directDebitCapCents":1000},"currency":"CAD","taxes":"plus-taxes"}'::jsonb, '{"amountCents":6900}'::jsonb, '{}'::jsonb, 'migration prices-2026-10'),
  ('akinaza.founder', '{"unit":"month","amountCents":3900,"availability":"founder-limited","limits":{"founderCap":20,"cardFeeBps":0,"directDebitBps":50,"directDebitCapCents":1500},"currency":"CAD","taxes":"plus-taxes"}'::jsonb, '{"availability":"internal"}'::jsonb, '{}'::jsonb, 'migration prices-2026-10')
) AS v(key, seed, patch, limits, label)
CROSS JOIN LATERAL (SELECT COALESCE((SELECT pv.price FROM price_versions pv WHERE pv.key = v.key ORDER BY pv.effective_from DESC, pv.id DESC LIMIT 1), v.seed) AS price) b
WHERE NOT EXISTS (SELECT 1 FROM price_versions pv WHERE pv.key = v.key AND pv.actor_label = v.label);
INSERT INTO settings_audit (actor_label, scope, scope_id, key, before, after)
SELECT pv.actor_label, 'global', '', pv.key, pv.before, pv.price FROM price_versions pv
WHERE pv.actor_label = 'migration prices-2026-10'
  AND NOT EXISTS (SELECT 1 FROM settings_audit a WHERE a.key = pv.key AND a.actor_label = pv.actor_label);

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
