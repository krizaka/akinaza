import type { DependantProfile } from "@akinaza/core";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import type { Db } from "./client";
import { clients, dependants, invoices } from "./schema";

/**
 * The shop's clients seen as files: how often they came, when last and next, what they spent. A visit is an appointment
 * of theirs that has begun and was neither cancelled nor missed; a client reaches an appointment directly (a salon) or
 * through a booking (a walker's group walk).
 */
const VISITS_OF_CLIENTS = (shopId: string) => sql`
  SELECT a.client_id, a.id AS appointment_id FROM appointments a WHERE a.shop_id = ${shopId} AND a.client_id IS NOT NULL
  UNION
  SELECT b.client_id, b.appointment_id FROM bookings b JOIN appointments a ON a.id = b.appointment_id WHERE a.shop_id = ${shopId} AND b.status = 'booked'`;

export interface ClientOverviewRow {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  visits: number;
  lastVisitAt: string | null;
  nextVisitAt: string | null;
  /** Invoices minus credit notes, in cents. */
  spentCents: number;
}

const iso = (value: string | null) => (value ? new Date(value).toISOString() : null);

export async function clientOverview(db: Db, shopId: string, now: Date): Promise<ClientOverviewRow[]> {
  const at = sql`${now.toISOString()}::timestamptz`;
  const found = await db.execute(sql`
    WITH v AS (${VISITS_OF_CLIENTS(shopId)})
    SELECT c.id, c.full_name, c.email, c.phone,
           count(a.id) FILTER (WHERE a.status IN ('booked','done') AND lower(a.during) <= ${at})::int AS visits,
           max(lower(a.during)) FILTER (WHERE a.status IN ('booked','done') AND lower(a.during) <= ${at}) AS last_visit,
           min(lower(a.during)) FILTER (WHERE a.status = 'booked' AND lower(a.during) > ${at}) AS next_visit,
           COALESCE((SELECT sum(i.total_cents) FROM invoices i WHERE i.client_id = c.id AND i.shop_id = c.shop_id), 0)::int AS spent
      FROM clients c LEFT JOIN v ON v.client_id = c.id LEFT JOIN appointments a ON a.id = v.appointment_id
     WHERE c.shop_id = ${shopId} AND c.erased_at IS NULL
     GROUP BY c.id ORDER BY c.full_name`);
  type Row = { id: string; full_name: string; email: string | null; phone: string | null; visits: number; last_visit: string | null; next_visit: string | null; spent: number };
  return (found.rows as Row[]).map((r) => ({ id: r.id, fullName: r.full_name, email: r.email, phone: r.phone, visits: r.visits, lastVisitAt: iso(r.last_visit), nextVisitAt: iso(r.next_visit), spentCents: r.spent }));
}

export interface ClientFileVisit {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "booked" | "done" | "cancelled" | "noShow";
  service: { fr: string; en: string };
  staff: string;
  priceCents: number;
}

export interface ClientFile {
  client: { id: string; fullName: string; email: string | null; phone: string | null; language: "fr" | "en"; notes: string | null; hasAccessNotes: boolean; since: string };
  dependants: { id: string; name: string; kind: "dog" | "cat" | "other"; profile: DependantProfile }[];
  /** Newest first. */
  visits: ClientFileVisit[];
  invoices: { id: string; number: string; issuedOn: string; totalCents: number; creditOf: string | null }[];
}

/** One client's file: who they are, their visits (past and to come), their invoices. Null for a client of another shop. */
export async function clientFile(db: Db, shopId: string, clientId: string): Promise<ClientFile | null> {
  const [client] = await db
    .select({ id: clients.id, fullName: clients.fullName, email: clients.email, phone: clients.phone, language: clients.language, notes: clients.notes, hasAccessNotes: sql<boolean>`${clients.accessNotesEnc} IS NOT NULL`, since: clients.createdAt })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.shopId, shopId), isNull(clients.erasedAt)));
  if (!client) return null;
  const visits = await db.execute(sql`
    WITH v AS (${VISITS_OF_CLIENTS(shopId)})
    SELECT a.id, lower(a.during) AS starts, upper(a.during) AS ends, a.status, sv.name_fr, sv.name_en, st.name AS staff, sv.price_cents
      FROM v JOIN appointments a ON a.id = v.appointment_id JOIN services sv ON sv.id = a.service_id JOIN staff st ON st.id = a.staff_id
     WHERE v.client_id = ${clientId} ORDER BY lower(a.during) DESC`);
  type VisitRow = { id: string; starts: string; ends: string; status: ClientFileVisit["status"]; name_fr: string; name_en: string; staff: string; price_cents: number };
  const pets = await db.select().from(dependants).where(and(eq(dependants.clientId, clientId), isNull(dependants.erasedAt))).orderBy(asc(dependants.name));
  const billed = await db
    .select({ id: invoices.id, number: invoices.number, issuedOn: invoices.issuedOn, totalCents: invoices.totalCents, creditOf: invoices.creditOf })
    .from(invoices)
    .where(and(eq(invoices.clientId, clientId), eq(invoices.shopId, shopId)))
    .orderBy(desc(invoices.createdAt), desc(invoices.number));
  return {
    client: { ...client, since: client.since.toISOString() },
    dependants: pets.map((p) => ({ id: p.id, name: p.name, kind: p.kind, profile: p.profile as DependantProfile })),
    visits: (visits.rows as VisitRow[]).map((r) => ({ id: r.id, startsAt: new Date(r.starts).toISOString(), endsAt: new Date(r.ends).toISOString(), status: r.status, service: { fr: r.name_fr, en: r.name_en }, staff: r.staff, priceCents: r.price_cents })),
    invoices: billed,
  };
}
