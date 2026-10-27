import type { FiguresInput } from "@akinaza/core";
import { sql } from "drizzle-orm";

import type { Db } from "./client";

const rows = async <T>(db: Db, query: ReturnType<typeof sql>) => (await db.execute(query)).rows as T[];

/** How many past weeks « a slot often empty » looks back over. */
// @fixed: the look-back of the empty-slot action; the thresholds that judge it are the administrator's settings.
export const SLOT_LOOK_BACK_WEEKS = 8;

/** A recurring slot (a weekday and the start of a working block): how often it was offered and how often something was booked in it. */
export interface SlotUse {
  weekday: number;
  startsAt: string;
  offered: number;
  booked: number;
}

/**
 * What the owner's figures read (#260), in the shop's own calendar: every invoice with what was paid on it, the payments, the expenses, the
 * appointments of the period, and how often the working blocks were booked. Read only; the figures themselves are computed in `@akinaza/core`.
 */
export async function figuresSnapshot(db: Db, shopId: string, at: { today: string; computedAt: string; period: { start: string; end: string } }): Promise<{ input: FiguresInput; slots: SlotUse[] }> {
  const [shop] = await rows<{ timezone: string }>(db, sql`SELECT timezone FROM shops WHERE id = ${shopId}`);
  if (!shop) throw new Error(`AK_SHOP_UNKNOWN: ${shopId}`);
  const tz = shop.timezone;
  const localDay = sql`(lower(a.during) AT TIME ZONE ${tz})::date`;

  const [invoices, payments, expenses, appointments, slots] = await Promise.all([
    rows<{ id: string; number: string; issued_on: string; due_on: string | null; subtotal_cents: number; gst_cents: number; qst_cents: number; total_cents: number; paid_cents: number; is_credit: boolean; superseded: boolean }>(
      db,
      sql`SELECT i.id, i.number, to_char(i.issued_on, 'YYYY-MM-DD') AS issued_on, to_char(i.due_on, 'YYYY-MM-DD') AS due_on,
                 i.subtotal_cents, i.gst_cents, i.qst_cents, i.total_cents,
                 coalesce((SELECT sum(p.amount_cents) FROM payments p WHERE p.invoice_id = i.id), 0)::int AS paid_cents,
                 (i.credit_of IS NOT NULL) AS is_credit,
                 EXISTS (SELECT 1 FROM invoices o WHERE o.credit_of = i.id OR o.replaces = i.id) AS superseded
            FROM invoices i WHERE i.shop_id = ${shopId} ORDER BY i.issued_on, i.number`,
    ),
    rows<{ id: string; invoice_id: string; amount_cents: number; received_on: string }>(
      db,
      sql`SELECT p.id, p.invoice_id, p.amount_cents, to_char((p.received_at AT TIME ZONE ${tz})::date, 'YYYY-MM-DD') AS received_on
            FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.shop_id = ${shopId} ORDER BY p.received_at, p.id`,
    ),
    rows<{ id: string; supplier: string; paid_on: string; subtotal_cents: number; gst_cents: number; qst_cents: number; business_share_pct: number }>(
      db,
      sql`SELECT id, supplier, to_char(paid_on, 'YYYY-MM-DD') AS paid_on, subtotal_cents, gst_cents, qst_cents, business_share_pct
            FROM expenses WHERE shop_id = ${shopId} ORDER BY paid_on, id`,
    ),
    rows<{ id: string; day: string; status: "booked" | "done" | "cancelled" | "noShow" }>(
      db,
      sql`SELECT a.id, to_char(${localDay}, 'YYYY-MM-DD') AS day, a.status FROM appointments a
           WHERE a.shop_id = ${shopId} AND ${localDay} >= ${at.period.start}::date AND ${localDay} <= ${at.period.end}::date ORDER BY lower(a.during), a.id`,
    ),
    rows<{ weekday: number; starts_at: string; offered: number; booked: number }>(
      db,
      sql`WITH d AS (SELECT (${at.today}::date - n) AS day FROM generate_series(1, ${SLOT_LOOK_BACK_WEEKS * 7}::int) AS n),
               occ AS (SELECT s.weekday, s.starts_at, s.ends_at, d.day, st.id AS staff_id
                         FROM schedules s JOIN staff st ON st.id = s.staff_id AND st.shop_id = ${shopId} AND st.active
                         JOIN d ON extract(dow FROM d.day) = s.weekday
                        WHERE NOT EXISTS (SELECT 1 FROM days_off o WHERE o.staff_id = st.id AND o.on_date = d.day))
          SELECT weekday::int, to_char(starts_at, 'HH24:MI') AS starts_at, count(*)::int AS offered,
                 (count(*) FILTER (WHERE EXISTS (
                    SELECT 1 FROM appointments a
                     WHERE a.staff_id = occ.staff_id AND a.status <> 'cancelled' AND ${localDay} = occ.day
                       AND ((lower(a.during) AT TIME ZONE ${tz})::time) >= occ.starts_at AND ((lower(a.during) AT TIME ZONE ${tz})::time) < occ.ends_at)))::int AS booked
            FROM occ GROUP BY weekday, starts_at ORDER BY weekday, starts_at`,
    ),
  ]);

  return {
    input: {
      today: at.today,
      computedAt: at.computedAt,
      period: at.period,
      invoices: invoices.map((i) => ({ id: i.id, number: i.number, issuedOn: i.issued_on, dueOn: i.due_on, subtotalCents: i.subtotal_cents, gstCents: i.gst_cents, qstCents: i.qst_cents, totalCents: i.total_cents, paidCents: i.paid_cents, isCredit: i.is_credit, superseded: i.superseded })),
      payments: payments.map((p) => ({ id: p.id, invoiceId: p.invoice_id, amountCents: p.amount_cents, receivedOn: p.received_on })),
      expenses: expenses.map((e) => ({ id: e.id, supplier: e.supplier, paidOn: e.paid_on, subtotalCents: e.subtotal_cents, gstCents: e.gst_cents, qstCents: e.qst_cents, businessSharePct: e.business_share_pct })),
      appointments: appointments.map((a) => ({ id: a.id, day: a.day, status: a.status })),
    },
    slots: slots.map((s) => ({ weekday: s.weekday, startsAt: s.starts_at, offered: s.offered, booked: s.booked })),
  };
}
