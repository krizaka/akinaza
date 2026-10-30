/**
 * The new price grid of 2026-10-30 (the founder asked to lower the prices; ADR-003 addendum): Starter 29 $ a month with three free
 * months, Pro (the former Scale B2B) 69 $, and the founder offer ends. It is DATA in the catalogue, never a rewrite of the seed:
 * the seed stays the history (a subscriber sold at `seed:akinaza.starter` keeps 45 $), and each change is a dated version in
 * `price_versions` with its line in `settings_audit`, exactly what the console's « schedule a change » writes. The migration's
 * SQL is generated from this list (a test keeps them equal) and the processor's catalogue (`infra/payments/catalogue.json`) sells
 * the amounts `scheduledPrice` gives.
 */
export const SCHEDULE_LABEL = "migration prices-2026-10";

interface Change {
  key: string;
  /** The entry as the seed holds it: what the version replaces when no administrator scheduled anything before. */
  seed: { unit: string; amountCents: number; availability: string; limits: Record<string, number> };
  patch: { amountCents?: number; availability?: string };
  limits?: Record<string, number>;
}

export const PRICE_SCHEDULE: readonly (Change & { label: string })[] = [
  { label: SCHEDULE_LABEL, key: "akinaza.starter", seed: { unit: "month", amountCents: 4500, availability: "public", limits: { cardFeeBps: 0, directDebitBps: 50, directDebitCapCents: 1500 } }, patch: { amountCents: 2900 }, limits: { trialDays: 90 } },
  { label: SCHEDULE_LABEL, key: "akinaza.scale", seed: { unit: "month", amountCents: 9900, availability: "public", limits: { cardFeeBps: 0, directDebitBps: 25, directDebitCapCents: 1000 } }, patch: { amountCents: 6900 } },
  { label: SCHEDULE_LABEL, key: "akinaza.founder", seed: { unit: "month", amountCents: 3900, availability: "founder-limited", limits: { founderCap: 20, cardFeeBps: 0, directDebitBps: 50, directDebitCapCents: 1500 } }, patch: { availability: "internal" } },
];

const json = (value: unknown) => JSON.stringify(value).replaceAll("'", "''");
const full = (seed: Change["seed"]) => ({ ...seed, currency: "CAD", taxes: "plus-taxes" });

/** A seed with the schedule's change of its key applied (a key not scheduled is returned as it is). */
export function scheduledPrice<T extends { amountCents: number | null; availability: string; limits: Record<string, number> }>(key: string, seed: T): T {
  const change = PRICE_SCHEDULE.find((c) => c.key === key);
  if (!change) return seed;
  return { ...seed, ...change.patch, limits: { ...seed.limits, ...change.limits } };
}

/** For each key: a version from now over the one in force (an administrator's earlier version, else the seed), once. */
export const PRICE_SCHEDULE_SQL = `-- The new price grid, as dated versions of the catalogue (akinaza ADR-003 addendum 2026-10-30): the seed is never rewritten, so a subscriber keeps the version it was sold at.
INSERT INTO price_versions (key, price, before, effective_from, created_at, actor_label)
SELECT v.key, b.price || v.patch || jsonb_build_object('limits', (b.price -> 'limits') || v.limits), b.price, now(), now(), v.label
FROM (VALUES
${PRICE_SCHEDULE.map((c) => `  ('${c.key}', '${json(full(c.seed))}'::jsonb, '${json(c.patch)}'::jsonb, '${json(c.limits ?? {})}'::jsonb, '${c.label}')`).join(",\n")}
) AS v(key, seed, patch, limits, label)
CROSS JOIN LATERAL (SELECT COALESCE((SELECT pv.price FROM price_versions pv WHERE pv.key = v.key ORDER BY pv.effective_from DESC, pv.id DESC LIMIT 1), v.seed) AS price) b
WHERE NOT EXISTS (SELECT 1 FROM price_versions pv WHERE pv.key = v.key AND pv.actor_label = v.label);
INSERT INTO settings_audit (actor_label, scope, scope_id, key, before, after)
SELECT pv.actor_label, 'global', '', pv.key, pv.before, pv.price FROM price_versions pv
WHERE pv.actor_label = '${SCHEDULE_LABEL}'
  AND NOT EXISTS (SELECT 1 FROM settings_audit a WHERE a.key = pv.key AND a.actor_label = pv.actor_label);
`;
