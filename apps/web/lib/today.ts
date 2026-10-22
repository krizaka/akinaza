import type { TaxCategory } from "@akinaza/core";
import { schema } from "@akinaza/db";
import { and, asc, eq, ne, sql } from "drizzle-orm";

import { type AppointmentStatus, isIsoDay } from "./day";
import { db } from "./db";

const { appointments, clients, services, shops, staff } = schema;

export interface TodayAppointment {
  id: string;
  startsAt: string;
  endsAt: string;
  staff: string;
  service: { fr: string; en: string };
  clientId: string | null;
  client: string | null;
  status: AppointmentStatus;
  checkedInAt: string | null;
  priceCents: number;
  category: TaxCategory;
}

export interface TodayView {
  shop: { id: string; name: string; registrant: boolean; timezone: string };
  /** The day shown, `YYYY-MM-DD` in the shop's time zone. */
  day: string;
  /** The shop's today: the strip marks it and « Today » returns to it. */
  today: string;
  appointments: TodayAppointment[];
}

/**
 * The shop's day, read on the server: the appointments of `requested` (the shop's today when absent or not a day) in the
 * shop's time zone. The account sees its own shop only.
 */
export async function todayView(accountId: string, requested?: string): Promise<TodayView | null> {
  const [shop] = await db().select().from(shops).where(eq(shops.ownerId, accountId)).orderBy(asc(shops.createdAt)).limit(1);
  if (!shop) return null;
  const [{ today } = { today: "" }] = (await db().execute(sql`SELECT to_char(now() AT TIME ZONE ${shop.timezone}, 'YYYY-MM-DD') AS today`)).rows as { today: string }[];
  const day = isIsoDay(requested) ? requested : today;
  const rows = await db()
    .select({ a: appointments, staff: staff.name, nameFr: services.nameFr, nameEn: services.nameEn, price: services.priceCents, category: services.taxCategory, clientId: clients.id, client: clients.fullName, start: sql<string>`lower(${appointments.during})`, end: sql<string>`upper(${appointments.during})` })
    .from(appointments)
    .innerJoin(staff, eq(staff.id, appointments.staffId))
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .leftJoin(clients, eq(clients.id, appointments.clientId))
    .where(and(eq(appointments.shopId, shop.id), ne(appointments.status, "cancelled"), sql`(lower(${appointments.during}) AT TIME ZONE ${shop.timezone})::date = ${day}::date`))
    .orderBy(sql`lower(${appointments.during})`);
  return {
    shop: { id: shop.id, name: shop.name, registrant: shop.registrant, timezone: shop.timezone },
    day,
    today,
    appointments: rows.map((r) => ({
      id: r.a.id,
      startsAt: new Date(r.start).toISOString(),
      endsAt: new Date(r.end).toISOString(),
      staff: r.staff,
      service: { fr: r.nameFr, en: r.nameEn },
      clientId: r.clientId,
      client: r.client,
      status: r.a.status,
      checkedInAt: r.a.checkedInAt?.toISOString() ?? null,
      priceCents: r.price,
      category: r.category as TaxCategory,
    })),
  };
}
