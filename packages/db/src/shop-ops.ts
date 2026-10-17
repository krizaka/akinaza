import { expenseEntries, invoiceEntries, invoiceTotals, type LedgerEntry, type LineInput, prepareReturn, type PreparedReturn, type SlotEvent } from "@akinaza/core";
import { and, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";

import type { Db, Tx } from "./client";
import { appointments, bookings, clientConsents, clients, dependants, expenses, invoiceLines, invoices, mailOutbox, services, shops, taxLedger, visitReports } from "./schema";

const post = (tx: Tx, shopId: string, entries: LedgerEntry[]) =>
  entries.length
    ? tx.insert(taxLedger).values(entries.map((e) => ({ shopId, period: e.period, tax: e.tax, direction: e.direction, amountCents: e.amountCents, sourceKind: e.source.kind, sourceId: e.source.id, sourceLabel: e.source.label })))
    : Promise.resolve();

/**
 * Issues an invoice: the next number of the shop (its row locked — no gap, no duplicate), the totals of @akinaza/core
 * (GST/QST once on the taxable base, rounded to the cent), the lines, and the ledger entries — one transaction; the
 * database checks at commit that the lines and the ledger add up to the invoice.
 */
export async function issueInvoice(db: Db, input: { shopId: string; clientId?: string | null; appointmentId?: string | null; language: "fr" | "en"; issuedOn: string; lines: LineInput[]; creditOf?: string | null }) {
  return db.transaction(async (tx) => {
    const [shop] = await tx.select().from(shops).where(eq(shops.id, input.shopId)).for("update");
    if (!shop) throw new Error(`AK_SHOP_UNKNOWN: ${input.shopId}`);
    const totals = invoiceTotals(input.lines, { registrant: shop.registrant });
    const number = `${shop.invoicePrefix}-${String(shop.nextInvoiceNumber).padStart(5, "0")}`;
    await tx.update(shops).set({ nextInvoiceNumber: shop.nextInvoiceNumber + 1 }).where(eq(shops.id, shop.id));
    const [invoice] = await tx
      .insert(invoices)
      .values({ shopId: shop.id, number, clientId: input.clientId ?? null, appointmentId: input.appointmentId ?? null, creditOf: input.creditOf ?? null, language: input.language, issuedOn: input.issuedOn, subtotalCents: totals.subtotalCents, gstCents: totals.gstCents, qstCents: totals.qstCents, totalCents: totals.totalCents })
      .returning();
    await tx.insert(invoiceLines).values(totals.lines.map((l, i) => ({ invoiceId: invoice!.id, position: i + 1, description: l.description, quantity: l.quantity, unitPriceCents: l.unitPriceCents, discountCents: l.discountCents ?? 0, taxCategory: l.category, amountCents: l.amountCents })));
    await post(tx, shop.id, invoiceEntries({ id: invoice!.id, number, issuedOn: input.issuedOn, gstCents: totals.gstCents, qstCents: totals.qstCents }));
    return { invoice: invoice!, totals };
  });
}

/** A credit note cancels an invoice: the same lines with negative quantities, its own number, negative ledger entries. */
export async function creditNote(db: Db, invoiceId: string, issuedOn: string) {
  const [original] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!original) throw new Error(`AK_INVOICE_UNKNOWN: ${invoiceId}`);
  const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId)).orderBy(invoiceLines.position);
  return issueInvoice(db, {
    shopId: original.shopId,
    clientId: original.clientId,
    language: original.language,
    issuedOn,
    creditOf: original.id,
    lines: lines.map((l) => ({ description: l.description, quantity: -l.quantity, unitPriceCents: l.unitPriceCents, discountCents: -l.discountCents, category: l.taxCategory })),
  });
}

/** Records an expense and the input tax credits (GST) and refunds (QST) it gives. */
export async function recordExpense(db: Db, input: { shopId: string; supplier: string; paidOn: string; subtotalCents: number; gstCents: number; qstCents: number; businessSharePct?: number; receiptRef?: string }) {
  return db.transaction(async (tx) => {
    const [expense] = await tx.insert(expenses).values({ ...input, businessSharePct: input.businessSharePct ?? 100 }).returning();
    await post(tx, input.shopId, expenseEntries({ id: expense!.id, supplier: expense!.supplier, paidOn: expense!.paidOn, gstCents: expense!.gstCents, qstCents: expense!.qstCents, businessSharePct: expense!.businessSharePct }));
    return expense!;
  });
}

/** Books a service with a staff member; a slot already taken is refused by the database (AK… no double booking). */
export async function book(db: Db, input: { shopId: string; staffId: string; serviceId: string; clientId?: string | null; startsAt: Date }): Promise<{ id: string; event: SlotEvent }> {
  const [service] = await db.select().from(services).where(and(eq(services.id, input.serviceId), eq(services.shopId, input.shopId)));
  if (!service) throw new Error(`AK_SERVICE_UNKNOWN: ${input.serviceId}`);
  const endsAt = new Date(input.startsAt.getTime() + service.durationMinutes * 60_000);
  const [row] = await db
    .insert(appointments)
    .values({ shopId: input.shopId, staffId: input.staffId, serviceId: input.serviceId, clientId: input.clientId ?? null, during: `[${input.startsAt.toISOString()},${endsAt.toISOString()})` })
    .returning({ id: appointments.id });
  return { id: row!.id, event: { type: "slot", shopId: input.shopId, staffId: input.staffId, startsAt: input.startsAt.toISOString(), endsAt: endsAt.toISOString(), status: "taken" } };
}

/** A consent decision (Loi 25), appended — never edited. */
export async function recordConsent(db: Db, clientId: string, purpose: "service" | "reminders" | "marketing", granted: boolean, textVersion: string) {
  await db.insert(clientConsents).values({ clientId, purpose, granted, textVersion });
}

/**
 * Erases a client's personal information (Loi 25): name replaced, contact, notes and access notes blanked, the sign-in
 * account unlinked, every dependant blanked, the notes and photos of the visit reports removed and their mails deleted,
 * every consent withdrawn — the row stays because the invoices that name it are kept (six years, tax law), and a visit
 * that happened stays as an anonymous fact. Returns false if already erased.
 */
export async function eraseClient(db: Db, clientId: string, textVersion: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx.update(clients).set({ fullName: "—", email: null, phone: null, notes: null, accessNotesEnc: null, accountId: null, erasedAt: sql`now()` }).where(and(eq(clients.id, clientId), isNull(clients.erasedAt))).returning({ id: clients.id });
    if (!row) return false;
    await tx.update(dependants).set({ name: "—", profile: {}, erasedAt: sql`now()` }).where(eq(dependants.clientId, clientId));
    const reports = tx.select({ id: visitReports.id }).from(visitReports).innerJoin(bookings, eq(bookings.id, visitReports.bookingId)).where(eq(bookings.clientId, clientId));
    await tx.delete(mailOutbox).where(and(eq(mailOutbox.relatedKind, "visit_report"), inArray(mailOutbox.relatedId, reports)));
    await tx.update(visitReports).set({ note: "—", photo: null, photoType: null, tokenExpiresAt: sql`now()`, viewTokenHash: sql`encode(sha256(gen_random_uuid()::text::bytea), 'hex')`, sentAt: null }).where(inArray(visitReports.bookingId, tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.clientId, clientId))));
    await tx.insert(clientConsents).values((["service", "reminders", "marketing"] as const).map((purpose) => ({ clientId, purpose, granted: false, textVersion })));
    return true;
  });
}

/** The prepared GST/QST return of a shop over a period, from its ledger and its invoices (supplies, line 101). */
export async function prepareShopReturn(db: Db, shopId: string, periodStart: string, periodEnd: string): Promise<PreparedReturn> {
  const rows = await db.select().from(taxLedger).where(eq(taxLedger.shopId, shopId));
  const [supplies] = await db
    .select({ cents: sql<number>`coalesce(sum(${invoices.subtotalCents}), 0)::int` })
    .from(invoices)
    .where(and(eq(invoices.shopId, shopId), gte(invoices.issuedOn, periodStart), lte(invoices.issuedOn, periodEnd)));
  return prepareReturn({
    periodStart,
    periodEnd,
    suppliesCents: supplies?.cents ?? 0,
    entries: rows.map((r) => ({ period: r.period, tax: r.tax, direction: r.direction, amountCents: r.amountCents, source: { kind: r.sourceKind, id: r.sourceId, label: r.sourceLabel } })),
  });
}
