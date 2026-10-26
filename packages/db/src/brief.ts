import { createHash, randomBytes } from "node:crypto";

import type { BriefSnapshot } from "@akinaza/core";
import { sql } from "drizzle-orm";

import type { Db } from "./client";

/** Who came to a visit: the appointment's client or, for a booked visit, its first booking's. */
const whoCame = sql.raw(`COALESCE(a.client_id, (SELECT b.client_id FROM bookings b WHERE b.appointment_id = a.id AND b.status = 'booked' ORDER BY b.created_at LIMIT 1))`);

const rows = async <T>(db: Db, query: ReturnType<typeof sql>) => (await db.execute(query)).rows as T[];

/**
 * The Monday brief's snapshot of one shop, read in the shop's own calendar: the active services, the done visits of the
 * look-back window, the open and booked minutes of the coming days, the clients of those visits (ids and flags only:
 * an e-mail on file, the latest marketing consent) and the previous week's invoices and expenses.
 */
export async function briefSnapshot(db: Db, shopId: string, at: { week: string; today: string; monday: string }, window: { lookBackWeeks: number; aheadDays: number }): Promise<BriefSnapshot> {
  const [shop] = await rows<{ timezone: string }>(db, sql`SELECT timezone FROM shops WHERE id = ${shopId}`);
  if (!shop) throw new Error(`AK_SHOP_UNKNOWN: ${shopId}`);
  const tz = shop.timezone;
  const localDay = sql`(lower(a.during) AT TIME ZONE ${tz})::date`;

  const [services, done, ahead, invoices, expenses] = await Promise.all([
    rows<{ id: string; price_cents: number; duration_minutes: number; price_varies: boolean }>(db, sql`SELECT id, price_cents, duration_minutes, price_varies FROM services WHERE shop_id = ${shopId} AND active ORDER BY id`),
    rows<{ id: string; service_id: string; client_id: string | null; day: string; minutes: number }>(
      db,
      sql`SELECT a.id, a.service_id, ${whoCame} AS client_id, to_char(${localDay}, 'YYYY-MM-DD') AS day,
                 round(extract(epoch FROM upper(a.during) - lower(a.during)) / 60)::int AS minutes
            FROM appointments a
           WHERE a.shop_id = ${shopId} AND a.status = 'done'
             AND ${localDay} >= ${at.today}::date - ${window.lookBackWeeks * 7}::int AND ${localDay} < ${at.today}::date
           ORDER BY lower(a.during), a.id`,
    ),
    rows<{ day: string; open_minutes: number; booked_minutes: number }>(
      db,
      sql`WITH d AS (SELECT (${at.today}::date + n) AS day FROM generate_series(0, ${window.aheadDays - 1}::int) AS n)
          SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
                 COALESCE((SELECT sum(extract(epoch FROM s.ends_at - s.starts_at) / 60) FROM schedules s JOIN staff st ON st.id = s.staff_id
                            WHERE st.shop_id = ${shopId} AND st.active AND s.weekday = extract(dow FROM d.day)
                              AND NOT EXISTS (SELECT 1 FROM days_off o WHERE o.staff_id = st.id AND o.on_date = d.day)), 0)::int AS open_minutes,
                 COALESCE((SELECT sum(extract(epoch FROM upper(a.during) - lower(a.during)) / 60) FROM appointments a
                            WHERE a.shop_id = ${shopId} AND a.status <> 'cancelled' AND ${localDay} = d.day), 0)::int AS booked_minutes
            FROM d ORDER BY d.day`,
    ),
    rows<{ id: string; number: string; issued_on: string; total_cents: number; gst_cents: number; qst_cents: number }>(
      db,
      sql`SELECT id, number, to_char(issued_on, 'YYYY-MM-DD') AS issued_on, total_cents, gst_cents, qst_cents FROM invoices
           WHERE shop_id = ${shopId} AND issued_on >= ${at.monday}::date - 7 AND issued_on < ${at.monday}::date ORDER BY issued_on, number`,
    ),
    rows<{ id: string; supplier: string; paid_on: string; gst_cents: number; qst_cents: number; business_share_pct: number }>(
      db,
      sql`SELECT id, supplier, to_char(paid_on, 'YYYY-MM-DD') AS paid_on, gst_cents, qst_cents, business_share_pct FROM expenses
           WHERE shop_id = ${shopId} AND paid_on >= ${at.monday}::date - 7 AND paid_on < ${at.monday}::date ORDER BY paid_on, id`,
    ),
  ]);

  const clientIds = [...new Set(done.map((v) => v.client_id).filter((id): id is string => id !== null))];
  const clients = clientIds.length
    ? await rows<{ id: string; contactable: boolean; marketing: boolean; erased: boolean }>(
        db,
        sql`SELECT c.id, (c.email IS NOT NULL) AS contactable, (c.erased_at IS NOT NULL) AS erased,
                   COALESCE((SELECT k.granted FROM client_consents k WHERE k.client_id = c.id AND k.purpose = 'marketing' ORDER BY k.at DESC, k.id DESC LIMIT 1), false) AS marketing
              FROM clients c WHERE c.shop_id = ${shopId} AND c.id IN (${sql.join(clientIds.map((id) => sql`${id}::uuid`), sql`, `)}) ORDER BY c.id`,
      )
    : [];

  return {
    week: at.week,
    today: at.today,
    services: services.map((s) => ({ id: s.id, priceCents: s.price_cents, durationMinutes: s.duration_minutes, priceVaries: s.price_varies })),
    done: done.map((v) => ({ id: v.id, serviceId: v.service_id, clientId: v.client_id, day: v.day, minutes: v.minutes })),
    ahead: ahead.map((d) => ({ day: d.day, openMinutes: d.open_minutes, bookedMinutes: d.booked_minutes })),
    clients,
    lastWeek: {
      invoices: invoices.map((i) => ({ id: i.id, number: i.number, issuedOn: i.issued_on, totalCents: i.total_cents, gstCents: i.gst_cents, qstCents: i.qst_cents })),
      expenses: expenses.map((e) => ({ id: e.id, supplier: e.supplier, paidOn: e.paid_on, gstCents: e.gst_cents, qstCents: e.qst_cents, businessSharePct: e.business_share_pct })),
    },
  };
}

/** Claims a recommendation's action for the shop: true the first time, false when it was already done (idempotent). */
export async function claimBriefAction(db: Db, shopId: string, recommendationId: string, kind: "invite" | "price" | "taxes"): Promise<boolean> {
  const done = await rows<{ shop_id: string }>(
    db,
    sql`INSERT INTO brief_actions (shop_id, recommendation_id, kind) VALUES (${shopId}, ${recommendationId}, ${kind}) ON CONFLICT DO NOTHING RETURNING shop_id`,
  );
  return done.length === 1;
}

/** Records what an action did (how many invitations went out, were kept waiting, were skipped). */
export async function recordBriefResult(db: Db, shopId: string, recommendationId: string, result: Record<string, number>): Promise<void> {
  await db.execute(sql`UPDATE brief_actions SET result = ${JSON.stringify(result)}::jsonb WHERE shop_id = ${shopId} AND recommendation_id = ${recommendationId}`);
}

/** The actions taken on one week's brief, by recommendation id. */
export async function briefActionsOf(db: Db, shopId: string, week: string): Promise<Record<string, Record<string, number>>> {
  const done = await rows<{ recommendation_id: string; result: Record<string, number> }>(
    db,
    sql`SELECT recommendation_id, result FROM brief_actions WHERE shop_id = ${shopId} AND recommendation_id LIKE ${`${week}:%`}`,
  );
  return Object.fromEntries(done.map((d) => [d.recommendation_id, d.result]));
}

/**
 * The clients an invitation may go to, read again at send time: of the shop, not erased, an e-mail on file, the latest
 * marketing consent granted (Loi 25, CASL). Whoever is not here is skipped, never written to.
 */
export async function reachableClients(db: Db, shopId: string, clientIds: readonly string[]): Promise<{ id: string; fullName: string; email: string; language: "fr" | "en" }[]> {
  if (clientIds.length === 0) return [];
  return rows(
    db,
    sql`SELECT c.id, c.full_name AS "fullName", c.email, c.language FROM clients c
         WHERE c.shop_id = ${shopId} AND c.erased_at IS NULL AND c.email IS NOT NULL
           AND c.id IN (${sql.join(clientIds.map((id) => sql`${id}::uuid`), sql`, `)})
           AND COALESCE((SELECT k.granted FROM client_consents k WHERE k.client_id = c.id AND k.purpose = 'marketing' ORDER BY k.at DESC, k.id DESC LIMIT 1), false)
         ORDER BY c.id`,
  );
}
/** The shops whose Monday brief may be e-mailed: the owner's address and language, the time zone, the last week sent. */
export async function briefMailShops(db: Db): Promise<{ id: string; name: string; slug: string | null; published: boolean; timezone: string; ownerEmail: string; ownerLocale: "fr" | "en"; lastWeek: string | null }[]> {
  return rows(
    db,
    sql`SELECT s.id, s.name, s.slug, s.published, s.timezone, a.email AS "ownerEmail", a.locale AS "ownerLocale",
               (SELECT max(d.week) FROM brief_deliveries d WHERE d.shop_id = s.id) AS "lastWeek"
          FROM shops s JOIN accounts a ON a.id = s.owner_id
         WHERE s.brief_email AND a.status = 'ACTIVE'
         ORDER BY s.id`,
  );
}

/**
 * Claims this week's e-mail for a shop: the unsubscribe token's hash on success, null when another instance (or an
 * earlier tick) already sent it. The token itself is made here and returned once; only its SHA-256 is stored.
 */
export async function claimBriefDelivery(db: Db, shopId: string, week: string, items: number): Promise<string | null> {
  const token = randomBytes(32).toString("base64url");
  const claimed = await rows<{ shop_id: string }>(
    db,
    sql`INSERT INTO brief_deliveries (shop_id, week, items, unsubscribe_sha256) VALUES (${shopId}, ${week}, ${items}, ${sha256(token)}) ON CONFLICT DO NOTHING RETURNING shop_id`,
  );
  return claimed.length === 1 ? token : null;
}

/** Whether a link's token leads somewhere (the page of an unknown token answers 404): read only, it changes nothing. */
export async function briefTokenKnown(db: Db, token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  return (await rows<{ ok: number }>(db, sql`SELECT 1 AS ok FROM brief_deliveries WHERE unsubscribe_sha256 = ${sha256(token)} LIMIT 1`)).length === 1;
}

/** Turns the shop's Monday e-mail off from the link of one of its mails; false for a token that leads nowhere. */
export async function unsubscribeBrief(db: Db, token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const off = await rows<{ id: string }>(
    db,
    sql`UPDATE shops SET brief_email = false WHERE id = (SELECT shop_id FROM brief_deliveries WHERE unsubscribe_sha256 = ${sha256(token)} LIMIT 1) RETURNING id`,
  );
  return off.length === 1;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
