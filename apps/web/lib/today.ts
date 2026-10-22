import type { TaxCategory } from "@akinaza/core";
import { schema } from "@akinaza/db";
import { and, eq, ne, sql } from "drizzle-orm";

import { type AppointmentStatus, isIsoDay } from "./day";
import { db } from "./db";

const { appointments, clients, services, staff } = schema;

const whoComes = sql<string | null>`COALESCE(${appointments.clientId}, (SELECT b.client_id FROM bookings b WHERE b.appointment_id = ${appointments.id} AND b.status = 'booked' ORDER BY b.created_at LIMIT 1))`;

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
 * The shop's day, read on the server: the appointments of `options.day` (the shop's today when absent or not a day) in the
 * shop's time zone. `staffAccountId` narrows it to the appointments of that person (a staff member sees their own agenda).
 * The client of an appointment is read from the appointment or, for a booked visit, from its first booking.
 */
export async function todayView(shop: { id: string; name: string; registrant: boolean; timezone: string }, options: { day?: string; staffAccountId?: string } = {}): Promise<TodayView> {
  const requested = options.day;
  const [{ today } = { today: "" }] = (await db().execute(sql`SELECT to_char(now() AT TIME ZONE ${shop.timezone}, 'YYYY-MM-DD') AS today`)).rows as { today: string }[];
  const day = isIsoDay(requested) ? requested : today;
  const rows = await db()
    .select({ a: appointments, staff: staff.name, nameFr: services.nameFr, nameEn: services.nameEn, price: services.priceCents, category: services.taxCategory, clientId: clients.id, client: clients.fullName, start: sql<string>`lower(${appointments.during})`, end: sql<string>`upper(${appointments.during})` })
    .from(appointments)
    .innerJoin(staff, eq(staff.id, appointments.staffId))
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .leftJoin(clients, sql`${clients.id} = ${whoComes}`)
    .where(and(eq(appointments.shopId, shop.id), options.staffAccountId ? eq(staff.accountId, options.staffAccountId) : undefined, ne(appointments.status, "cancelled"), sql`(lower(${appointments.during}) AT TIME ZONE ${shop.timezone})::date = ${day}::date`))
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
