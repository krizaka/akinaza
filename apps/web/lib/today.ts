import { type InvoiceTotals, invoiceTotals, type TaxCategory } from "@akinaza/core";
import { schema } from "@akinaza/db";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";

import { db } from "./db";

const { appointments, clients, invoiceLines, invoices, services, shops, staff } = schema;

export interface TodayView {
  shop: { id: string; name: string; legalName: string; address: string; registrant: boolean; gstNumber: string | null; qstNumber: string | null; timezone: string };
  day: string;
  appointments: { id: string; startsAt: string; endsAt: string; staff: string; service: { fr: string; en: string }; client: string | null; status: "booked" | "done" | "cancelled" | "noShow"; priceCents: number }[];
  /** The latest issued invoice — or, when there is none yet, a preview of the next one (nothing issued, nothing posted). */
  invoice: { kind: "issued" | "preview"; number: string | null; issuedOn: string; language: "fr" | "en"; client: string | null; totals: InvoiceTotals } | null;
}

/**
 * The shop's day, read on the server: the appointments of today in the shop's time zone, and an invoice with its GST and
 * QST lines. The account sees its own shop only.
 */
export async function todayView(accountId: string): Promise<TodayView | null> {
  const [shop] = await db().select().from(shops).where(eq(shops.ownerId, accountId)).orderBy(asc(shops.createdAt)).limit(1);
  if (!shop) return null;
  const [{ day } = { day: "" }] = (await db().execute(sql`SELECT to_char(now() AT TIME ZONE ${shop.timezone}, 'YYYY-MM-DD') AS day`)).rows as { day: string }[];
  const rows = await db()
    .select({ a: appointments, staff: staff.name, nameFr: services.nameFr, nameEn: services.nameEn, price: services.priceCents, category: services.taxCategory, client: clients.fullName, start: sql<string>`lower(${appointments.during})`, end: sql<string>`upper(${appointments.during})` })
    .from(appointments)
    .innerJoin(staff, eq(staff.id, appointments.staffId))
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .leftJoin(clients, eq(clients.id, appointments.clientId))
    .where(and(eq(appointments.shopId, shop.id), ne(appointments.status, "cancelled"), sql`(lower(${appointments.during}) AT TIME ZONE ${shop.timezone})::date = ${day}::date`))
    .orderBy(sql`lower(${appointments.during})`);
  const list = rows.map((r) => ({ id: r.a.id, startsAt: new Date(r.start).toISOString(), endsAt: new Date(r.end).toISOString(), staff: r.staff, service: { fr: r.nameFr, en: r.nameEn }, client: r.client, status: r.a.status, priceCents: r.price, category: r.category as TaxCategory }));

  const [last] = await db().select({ i: invoices, client: clients.fullName }).from(invoices).leftJoin(clients, eq(clients.id, invoices.clientId)).where(eq(invoices.shopId, shop.id)).orderBy(desc(invoices.createdAt)).limit(1);
  let invoice: TodayView["invoice"] = null;
  if (last) {
    const lines = await db().select().from(invoiceLines).where(eq(invoiceLines.invoiceId, last.i.id)).orderBy(asc(invoiceLines.position));
    const totals = invoiceTotals(lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPriceCents: l.unitPriceCents, discountCents: l.discountCents, category: l.taxCategory })), { registrant: shop.registrant });
    invoice = { kind: "issued", number: last.i.number, issuedOn: last.i.issuedOn, language: last.i.language, client: last.client, totals };
  } else if (list[0]) {
    const first = list[0];
    invoice = { kind: "preview", number: null, issuedOn: day, language: "fr", client: first.client, totals: invoiceTotals([{ description: `${first.service.fr} / ${first.service.en}`, quantity: 1, unitPriceCents: first.priceCents, category: first.category }], { registrant: shop.registrant }) };
  }
  return {
    shop: { id: shop.id, name: shop.name, legalName: shop.legalName, address: shop.address, registrant: shop.registrant, gstNumber: shop.gstNumber, qstNumber: shop.qstNumber, timezone: shop.timezone },
    day,
    appointments: list.map((a) => ({ id: a.id, startsAt: a.startsAt, endsAt: a.endsAt, staff: a.staff, service: a.service, client: a.client, status: a.status, priceCents: a.priceCents })),
    invoice,
  };
}
