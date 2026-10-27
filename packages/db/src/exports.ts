import { sql } from "drizzle-orm";

import type { Db } from "./client";

/**
 * The owner's data, read in batches for the exports (#420, ADR-004 §5): appointments, clients, invoices. Each is an async generator over a
 * keyset (never an offset), so a shop of any size streams in constant memory. Only what the owner already sees on their own screens: no access
 * notes, no sealed secret, no erased person's details, nothing of another shop.
 */

// @fixed: rows read per round trip; the stream holds one batch at a time
export const EXPORT_BATCH = 500;

export interface AppointmentExportRow {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: "booked" | "done" | "cancelled" | "noShow";
  serviceFr: string;
  serviceEn: string;
  staff: string;
  /** The client the appointment was made for; empty for a walk, a class seat, or a person who was erased. */
  client: string;
  priceCents: number;
}

export interface ClientExportRow {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  language: "fr" | "en";
  createdAt: Date;
  dependants: string[];
}

export interface InvoiceExportRow {
  id: string;
  number: string;
  issuedOn: string;
  dueOn: string | null;
  language: "fr" | "en";
  /** The number of the invoice a credit note cancels. */
  creditOf: string | null;
  client: string | null;
  subtotalCents: number;
  gstCents: number;
  qstCents: number;
  totalCents: number;
  paidCents: number;
  superseded: boolean;
}

type Raw = Record<string, unknown>;
const rowsOf = (result: { rows: unknown[] }) => result.rows as Raw[];

/** Appointments by start then id, oldest first. */
export async function* exportAppointments(db: Db, shopId: string, batch = EXPORT_BATCH): AsyncGenerator<AppointmentExportRow[]> {
  let after: { at: string; id: string } | null = null;
  for (;;) {
    const cursor: ReturnType<typeof sql> = after ? sql`AND (lower(a.during), a.id) > (${after.at}::timestamptz, ${after.id}::uuid)` : sql``;
    const rows = rowsOf(
      await db.execute(sql`
        SELECT a.id, lower(a.during)::text AS starts_at, upper(a.during)::text AS ends_at, a.status, s.name_fr, s.name_en, s.price_cents, st.name AS staff,
               CASE WHEN c.erased_at IS NULL THEN c.full_name ELSE NULL END AS client
        FROM appointments a
        JOIN services s ON s.id = a.service_id
        JOIN staff st ON st.id = a.staff_id
        LEFT JOIN clients c ON c.id = a.client_id
        WHERE a.shop_id = ${shopId} ${cursor}
        ORDER BY lower(a.during), a.id
        LIMIT ${batch}`),
    );
    if (rows.length === 0) return;
    yield rows.map((r) => ({
      id: r.id as string,
      startsAt: new Date(r.starts_at as string),
      endsAt: new Date(r.ends_at as string),
      status: r.status as AppointmentExportRow["status"],
      serviceFr: r.name_fr as string,
      serviceEn: r.name_en as string,
      staff: r.staff as string,
      client: (r.client as string | null) ?? "",
      priceCents: Number(r.price_cents),
    }));
    if (rows.length < batch) return;
    const last = rows[rows.length - 1]!;
    after = { at: last.starts_at as string, id: last.id as string };
  }
}

/** Client files by name then id; an erased file is not exported (its details are gone), and access notes never are. */
export async function* exportClients(db: Db, shopId: string, batch = EXPORT_BATCH): AsyncGenerator<ClientExportRow[]> {
  let after: { name: string; id: string } | null = null;
  for (;;) {
    const cursor: ReturnType<typeof sql> = after ? sql`AND (c.full_name, c.id) > (${after.name}, ${after.id}::uuid)` : sql``;
    const rows = rowsOf(
      await db.execute(sql`
        SELECT c.id, c.full_name, c.email, c.phone, c.language, c.created_at::text AS created_at,
               COALESCE((SELECT array_agg(d.name ORDER BY d.name) FROM dependants d WHERE d.client_id = c.id AND d.erased_at IS NULL), '{}') AS dependants
        FROM clients c
        WHERE c.shop_id = ${shopId} AND c.erased_at IS NULL ${cursor}
        ORDER BY c.full_name, c.id
        LIMIT ${batch}`),
    );
    if (rows.length === 0) return;
    yield rows.map((r) => ({
      id: r.id as string,
      fullName: r.full_name as string,
      email: (r.email as string | null) ?? null,
      phone: (r.phone as string | null) ?? null,
      language: r.language as "fr" | "en",
      createdAt: new Date(r.created_at as string),
      dependants: (r.dependants as string[]) ?? [],
    }));
    if (rows.length < batch) return;
    const last = rows[rows.length - 1]!;
    after = { name: last.full_name as string, id: last.id as string };
  }
}

/** Invoices (and credit notes) by issue date, then number: the order of the books. */
export async function* exportInvoices(db: Db, shopId: string, batch = EXPORT_BATCH): AsyncGenerator<InvoiceExportRow[]> {
  let after: { on: string; number: string } | null = null;
  for (;;) {
    const cursor: ReturnType<typeof sql> = after ? sql`AND (i.issued_on, i.number) > (${after.on}::date, ${after.number})` : sql``;
    const rows = rowsOf(
      await db.execute(sql`
        SELECT i.id, i.number, i.issued_on::text AS issued_on, i.due_on::text AS due_on, i.language, o.number AS credit_of_number,
               CASE WHEN c.erased_at IS NULL THEN c.full_name ELSE NULL END AS client,
               i.subtotal_cents, i.gst_cents, i.qst_cents, i.total_cents,
               COALESCE((SELECT sum(p.amount_cents) FROM payments p WHERE p.invoice_id = i.id), 0)::int AS paid_cents,
               EXISTS (SELECT 1 FROM invoices x WHERE x.credit_of = i.id OR x.replaces = i.id) AS superseded
        FROM invoices i
        LEFT JOIN invoices o ON o.id = i.credit_of
        LEFT JOIN clients c ON c.id = i.client_id
        WHERE i.shop_id = ${shopId} ${cursor}
        ORDER BY i.issued_on, i.number
        LIMIT ${batch}`),
    );
    if (rows.length === 0) return;
    yield rows.map((r) => ({
      id: r.id as string,
      number: r.number as string,
      issuedOn: r.issued_on as string,
      dueOn: (r.due_on as string | null) ?? null,
      language: r.language as "fr" | "en",
      creditOf: (r.credit_of_number as string | null) ?? null,
      client: (r.client as string | null) ?? null,
      subtotalCents: Number(r.subtotal_cents),
      gstCents: Number(r.gst_cents),
      qstCents: Number(r.qst_cents),
      totalCents: Number(r.total_cents),
      paidCents: Number(r.paid_cents),
      superseded: Boolean(r.superseded),
    }));
    if (rows.length < batch) return;
    const last = rows[rows.length - 1]!;
    after = { on: last.issued_on as string, number: last.number as string };
  }
}
