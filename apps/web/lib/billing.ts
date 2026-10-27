import { applyOnceInTransaction, type PaymentEvent, type Query as TxQuery } from "@krizaka/payments";
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

/** The founder offer's seats: a business holds one from its first subscription on, whatever becomes of it (the offer is for the first businesses). */
export interface FounderSeats {
  limit: number;
  taken: number;
  open: boolean;
}

export async function founderSeats(query: Query, limit: number): Promise<FounderSeats> {
  const [r] = await query<{ taken: number }>("SELECT count(*)::int AS taken FROM accounts WHERE payment_subscription_id IS NOT NULL");
  const taken = r?.taken ?? 0;
  return { limit, taken, open: taken < limit };
}

/**
 * Who may open the founder checkout: `member` (already a founder: the limit never turns them away, and the price is the
 * subscription's, which nothing here rewrites), `open` (a seat is left) or `full` (the offer is no longer offered).
 */
export type FounderGate = "open" | "member" | "full";

export async function founderGate(query: Query, accountId: string, limit: number): Promise<FounderGate> {
  const [own] = await query<{ sub: string | null }>("SELECT payment_subscription_id AS sub FROM accounts WHERE id = $1", [accountId]);
  if (own?.sub) return "member";
  return (await founderSeats(query, limit)).open ? "open" : "full";
}

/**
 * The price a subscription is sold at (akinaza#371): the catalogue's version offered at the checkout is kept on the account
 * while it has no subscription yet; from the first subscription on nothing rewrites it (the webhook writes only the state),
 * so a founder keeps the founder price whatever the administrator schedules later.
 */
export async function recordOfferedVersion(query: Query, accountId: string, versionId: string): Promise<void> {
  await query("UPDATE accounts SET subscription_price_version = $2 WHERE id = $1 AND payment_subscription_id IS NULL", [accountId, versionId]);
}

/** The version of the catalogue an account's subscription was sold at, or null (no subscription, or sold before the catalogue). */
export async function soldVersionOf(query: Query, accountId: string): Promise<string | null> {
  const [r] = await query<{ version: string | null }>("SELECT subscription_price_version AS version FROM accounts WHERE id = $1 AND payment_subscription_id IS NOT NULL", [accountId]);
  return r?.version ?? null;
}

/** The transaction runner of the product's pool (`transaction` of `lib/db`): commit when the work returns, roll back when it throws. */
export type Transaction = <T>(work: (query: TxQuery) => Promise<T>) => Promise<T>;

/**
 * Applies a verified payment event once, recording its id and writing its effect in ONE transaction (akinaza#269): a handler
 * that throws rolls both back, so the processor's retry applies the event; a replay changes nothing. The record is the
 * `payment_events` table.
 */
export function applyPaymentEvent(transaction: Transaction, event: PaymentEvent): Promise<"applied" | "duplicate" | "ignored"> {
  return applyOnceInTransaction(transaction, event, {
    async subscription_started(e, query) {
      if (e.customerId) await query("UPDATE accounts SET payment_customer_id = COALESCE(payment_customer_id, $2) WHERE id = $1", [e.accountId, e.customerId]);
      await query("UPDATE accounts SET payment_subscription_id = $2, subscription_status = COALESCE(subscription_status, 'active') WHERE id = $1", [e.accountId, e.subscriptionId]);
    },
    async subscription_changed(e, query) {
      const rows = await query(
        `UPDATE accounts SET subscription_status = $3, payment_subscription_id = $4, current_period_end = to_timestamp($5)
           WHERE payment_customer_id = $1 OR id::text = $2 RETURNING id`,
        [e.customerId, e.accountId, e.status, e.subscriptionId, e.periodEnd],
      );
      return rows.length ? undefined : "ignored";
    },
  }, { table: { schema: "public", table: "payment_events" } });
}
