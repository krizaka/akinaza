import { type BoardPeriod, INVOICE_STATE, invoiceState, remainingCents, type TodayBoard } from "@akinaza/core";
import { sql } from "drizzle-orm";

import type { Db } from "./client";
import { listInvoices } from "./shop-ops";

// @fixed: « À facturer » looks back a month; an older unbilled visit is the books' business, not the day's
const TO_BILL_DAYS = 30;

const OWED: ReadonlySet<string> = new Set([INVOICE_STATE.due, INVOICE_STATE.partial, INVOICE_STATE.overdue]);

/**
 * Aujourd'hui's board (D4): the binder's counts, the activity strip and « À encaisser », read from the bookings, the invoices and
 * the payments of one shop — integer cents, the shop's calendar days (its time zone). `day` is the shop's today.
 */
export async function todayBoard(db: Db, shopId: string, { day, period }: { day: string; period: BoardPeriod }): Promise<TodayBoard> {
  const tz = sql`(SELECT timezone FROM shops WHERE id = ${shopId})`;
  const [week, toBill, series, bills] = await Promise.all([
    db.execute(sql`
      SELECT count(*)::int AS n FROM appointments
      WHERE shop_id = ${shopId} AND status NOT IN ('cancelled', 'noShow')
        AND (lower(during) AT TIME ZONE ${tz})::date BETWEEN date_trunc('week', ${day}::date)::date AND (date_trunc('week', ${day}::date) + interval '6 days')::date`),
    db.execute(sql`
      SELECT a.id AS "appointmentId", a.client_id AS "clientId", c.full_name AS client, a.service_id AS "serviceId", lower(a.during) AS "startsAt"
      FROM appointments a LEFT JOIN clients c ON c.id = a.client_id
      WHERE a.shop_id = ${shopId} AND a.status = 'done'
        AND (lower(a.during) AT TIME ZONE ${tz})::date BETWEEN ${day}::date - ${TO_BILL_DAYS}::int AND ${day}::date
        AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.appointment_id = a.id AND i.credit_of IS NULL
          AND NOT EXISTS (SELECT 1 FROM invoices o WHERE o.credit_of = i.id))
      ORDER BY lower(a.during)`),
    db.execute(sql`
      SELECT d::date::text AS day,
        coalesce((SELECT sum(total_cents) FROM invoices WHERE shop_id = ${shopId} AND issued_on = d::date), 0)::int AS invoiced,
        coalesce((SELECT sum(p.amount_cents) FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.shop_id = ${shopId} AND (p.received_at AT TIME ZONE ${tz})::date = d::date), 0)::int AS collected,
        (SELECT count(*) FROM appointments WHERE shop_id = ${shopId} AND status = 'done' AND (lower(during) AT TIME ZONE ${tz})::date = d::date)::int AS appointments
      FROM generate_series(${day}::date - (${period}::int - 1), ${day}::date, interval '1 day') AS d
      ORDER BY d`),
    listInvoices(db, shopId),
  ]);
  const rows = series.rows as { day: string; invoiced: number; collected: number; appointments: number }[];
  const owed = bills
    .map((i) => {
      const standing = { totalCents: i.totalCents, paidCents: i.paidCents, dueOn: i.dueOn, isCredit: i.creditOf !== null, superseded: i.superseded };
      return { invoice: i, state: invoiceState(standing, day), left: remainingCents(standing) };
    })
    .filter((o) => OWED.has(o.state));
  const late = owed.filter((o) => o.state === INVOICE_STATE.overdue);
  const first = [...late].sort((a, b) => (a.invoice.dueOn ?? "").localeCompare(b.invoice.dueOn ?? ""))[0] ?? [...owed].sort((a, b) => (a.invoice.dueOn ?? "9999").localeCompare(b.invoice.dueOn ?? "9999"))[0];
  return {
    week: (week.rows[0] as { n: number } | undefined)?.n ?? 0,
    toBill: (toBill.rows as TodayBoard["toBill"]).map((a) => ({ ...a, startsAt: new Date(a.startsAt).toISOString() })),
    activity: { days: rows.map((r) => r.day), invoicedCents: rows.map((r) => r.invoiced), collectedCents: rows.map((r) => r.collected), appointments: rows.map((r) => r.appointments) },
    balance: { owedCents: owed.reduce((n, o) => n + o.left, 0), overdueCents: late.reduce((n, o) => n + o.left, 0), count: owed.length, overdueCount: late.length },
    chase: first ? { id: first.invoice.id, number: first.invoice.number, client: first.invoice.client, dueOn: first.invoice.dueOn, remainingCents: first.left, overdue: first.state === INVOICE_STATE.overdue } : null,
  };
}
