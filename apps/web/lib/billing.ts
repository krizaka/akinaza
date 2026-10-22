import { applyOnce, type PaymentEvent, pgEventStore } from "@krizaka/payments";
import type { QueryResultRow } from "pg";

/**
 * The founder offer's state — the domain, vendor-free (it speaks the payments port's events, never a processor's). The
 * stored state mirrors the processor's notifications, each applied once; the webhook is the only writer of paid state.
 */
type Query = <T extends QueryResultRow>(text: string, values?: unknown[]) => Promise<T[]>;

/** The processor's states in which the member has the service. */
const LIVE_STATUSES: ReadonlySet<string> = new Set(["active", "trialing"]);

export interface Subscription {
  active: boolean;
  status: string | null;
  periodEnd: string | null;
  customerId: string | null;
}

export async function subscriptionOf(query: Query, accountId: string, now: Date): Promise<Subscription> {
  const [r] = await query<{ status: string | null; end: Date | null; customer: string | null }>(
    "SELECT subscription_status AS status, current_period_end AS \"end\", payment_customer_id AS customer FROM accounts WHERE id = $1",
    [accountId],
  );
  const live = !!r?.status && LIVE_STATUSES.has(r.status);
  return { active: !!r && live && (!r.end || r.end > now), status: r?.status ?? null, periodEnd: r?.end?.toISOString() ?? null, customerId: r?.customer ?? null };
}

/** The processor's customer of an account, created once (the id is kept; a second call reuses it). */
export async function customerOf(query: Query, accountId: string, create: () => Promise<{ id: string }>): Promise<string> {
  const [r] = await query<{ customer: string | null }>("SELECT payment_customer_id AS customer FROM accounts WHERE id = $1", [accountId]);
  if (r?.customer) return r.customer;
  const made = await create();
  const [kept] = await query<{ customer: string }>("UPDATE accounts SET payment_customer_id = COALESCE(payment_customer_id, $2) WHERE id = $1 RETURNING payment_customer_id AS customer", [accountId, made.id]);
  return kept?.customer ?? made.id;
}

/** Applies a verified payment event once (@krizaka/payments records its id first): a replay changes nothing. */
export function applyPaymentEvent(query: Query, event: PaymentEvent): Promise<"applied" | "duplicate" | "ignored"> {
  return applyOnce(pgEventStore(query), event, {
    async subscription_started(e) {
      if (e.customerId) await query("UPDATE accounts SET payment_customer_id = COALESCE(payment_customer_id, $2) WHERE id = $1", [e.accountId, e.customerId]);
      await query("UPDATE accounts SET payment_subscription_id = $2, subscription_status = COALESCE(subscription_status, 'active') WHERE id = $1", [e.accountId, e.subscriptionId]);
    },
    async subscription_changed(e) {
      const rows = await query(
        `UPDATE accounts SET subscription_status = $3, payment_subscription_id = $4, current_period_end = to_timestamp($5)
           WHERE payment_customer_id = $1 OR id::text = $2 RETURNING id`,
        [e.customerId, e.accountId, e.status, e.subscriptionId, e.periodEnd],
      );
      return rows.length ? undefined : "ignored";
    },
  });
}
