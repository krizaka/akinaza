import { dueOn, expenseEntries, invoiceEntries, invoiceTotals, type LedgerEntry, type LineInput, prepareReturn, type PreparedReturn, type SlotEvent, termsDaysSchema } from "@akinaza/core";
import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db, Tx } from "./client";
import { appointments, bookings, clientConsents, clients, dependants, expenses, invoiceDeliveries, invoiceLines, invoices, mailOutbox, services, shops, taxLedger, visitReports } from "./schema";
import { ShopError } from "./errors";

const post = (tx: Tx, shopId: string, entries: LedgerEntry[]) =>
  entries.length
    ? tx.insert(taxLedger).values(entries.map((e) => ({ shopId, period: e.period, tax: e.tax, direction: e.direction, amountCents: e.amountCents, sourceKind: e.source.kind, sourceId: e.source.id, sourceLabel: e.source.label })))
    : Promise.resolve();

/**
 * Issues an invoice: the next number of the shop (its row locked — no gap, no duplicate), the totals of @akinaza/core
 * (GST/QST once on the taxable base, rounded to the cent), the lines, and the ledger entries — one transaction; the
 * database checks at commit that the lines and the ledger add up to the invoice.
 */
export async function issueInvoice(db: Db | Tx, input: { shopId: string; clientId?: string | null; appointmentId?: string | null; language: "fr" | "en"; issuedOn: string; lines: LineInput[]; creditOf?: string | null; replaces?: string | null; termsDays?: number | null }) {
  return db.transaction(async (tx) => {
    const [shop] = await tx.select().from(shops).where(eq(shops.id, input.shopId)).for("update");
    if (!shop) throw new Error(`AK_SHOP_UNKNOWN: ${input.shopId}`);
    const totals = invoiceTotals(input.lines, { registrant: shop.registrant });
    // The terms the invoice is issued under: the one asked for, else the shop's own; a credit note has none (it cancels, it is not due).
    const termsDays = input.creditOf ? null : (input.termsDays ?? shop.paymentTermsDays);
    const number = `${shop.invoicePrefix}-${String(shop.nextInvoiceNumber).padStart(5, "0")}`;
    await tx.update(shops).set({ nextInvoiceNumber: shop.nextInvoiceNumber + 1 }).where(eq(shops.id, shop.id));
    const [invoice] = await tx
      .insert(invoices)
      .values({ shopId: shop.id, number, clientId: input.clientId ?? null, appointmentId: input.appointmentId ?? null, creditOf: input.creditOf ?? null, replaces: input.replaces ?? null, language: input.language, issuedOn: input.issuedOn, termsDays, dueOn: termsDays === null ? null : dueOn(input.issuedOn, termsDays), subtotalCents: totals.subtotalCents, gstCents: totals.gstCents, qstCents: totals.qstCents, totalCents: totals.totalCents })
      .returning();
    await tx.insert(invoiceLines).values(totals.lines.map((l, i) => ({ invoiceId: invoice!.id, position: i + 1, description: l.description, quantityHundredths: l.quantityHundredths, unitPriceCents: l.unitPriceCents, discountCents: l.discountCents ?? 0, taxCategory: l.category, amountCents: l.amountCents })));
    await post(tx, shop.id, invoiceEntries({ id: invoice!.id, number, issuedOn: input.issuedOn, gstCents: totals.gstCents, qstCents: totals.qstCents }));
    return { invoice: invoice!, totals };
  });
}

/** A credit note cancels an invoice: the same lines with negative quantities, its own number, negative ledger entries. */
export async function creditNote(db: Db | Tx, invoiceId: string, issuedOn: string) {
  const [original] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!original) throw new Error(`AK_INVOICE_UNKNOWN: ${invoiceId}`);
  const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId)).orderBy(invoiceLines.position);
  return issueInvoice(db, {
    shopId: original.shopId,
    clientId: original.clientId,
    language: original.language,
    issuedOn,
    creditOf: original.id,
    lines: lines.map((l) => ({ description: l.description, quantity: -l.quantityHundredths / 100, unitPriceCents: l.unitPriceCents, discountCents: -l.discountCents, category: l.taxCategory })),
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
    const invoiceIds = tx.select({ id: invoices.id }).from(invoices).where(eq(invoices.clientId, clientId));
    const deliveryIds = tx.select({ id: invoiceDeliveries.id }).from(invoiceDeliveries).innerJoin(invoices, eq(invoices.id, invoiceDeliveries.invoiceId)).where(eq(invoices.clientId, clientId));
    await tx.delete(mailOutbox).where(and(eq(mailOutbox.relatedKind, "invoice_delivery"), inArray(mailOutbox.relatedId, deliveryIds)));
    await tx.update(invoiceDeliveries).set({ revokedAt: sql`now()`, toEmail: "—" }).where(inArray(invoiceDeliveries.invoiceId, invoiceIds));
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


const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * An invoice a business asks for: a client (optional), a language, a day and lines. A line is a **service** of the shop
 * (its bilingual name, its price and its tax category are the defaults; a negotiated price overrides the price) or free text
 * with its own price. Quantities are whole numbers (hours, days, packages); fractional hours are not billable yet.
 */
export const invoiceInputSchema = z.object({
  clientId: z.string().uuid().nullish(),
  language: z.enum(["fr", "en"]),
  issuedOn: iso,
  /** The payment terms in days (0 = due on receipt); omitted = the shop's own. */
  termsDays: termsDaysSchema.optional(),
  lines: z
    .array(
      z.object({
        serviceId: z.string().uuid().optional(),
        description: z.string().trim().min(1).max(200).optional(),
        /** Units billed, to the hundredth (7.5 hours): at least 0.01, at most 10 000. */
        quantity: z.number().min(0.01).max(10_000).refine((q) => Math.abs(q * 100 - Math.round(q * 100)) < 1e-6, { message: "a quantity has at most two decimals" }),
        unitPriceCents: z.number().int().min(0).max(100_000_000).optional(),
        category: z.enum(["standard", "zeroRated", "exempt"]).optional(),
      }).refine((l) => l.serviceId || l.description, { message: "a line names a service or a description" }),
    )
    .min(1)
    .max(40),
});
export type InvoiceInput = z.input<typeof invoiceInputSchema>;

/** Issues an invoice for the shop from its services and free lines (the same transaction as `issueInvoice`). */
export async function issueShopInvoice(db: Db | Tx, shopId: string, raw: InvoiceInput, link: { replaces?: string } = {}) {
  const input = invoiceInputSchema.parse(raw);
  if (input.clientId) {
    const [client] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, input.clientId), eq(clients.shopId, shopId)));
    if (!client) throw new ShopError("AK_CLIENT_UNKNOWN", `AK_CLIENT_UNKNOWN: ${input.clientId}`);
  }
  const lines: LineInput[] = [];
  for (const l of input.lines) {
    if (l.serviceId) {
      const [service] = await db.select().from(services).where(and(eq(services.id, l.serviceId), eq(services.shopId, shopId)));
      if (!service) throw new ShopError("AK_SERVICE_UNKNOWN", `AK_SERVICE_UNKNOWN: ${l.serviceId}`);
      lines.push({ description: l.description ?? `${service.nameFr} / ${service.nameEn}`, quantity: l.quantity, unitPriceCents: l.unitPriceCents ?? service.priceCents, category: l.category ?? service.taxCategory });
    } else {
      if (l.unitPriceCents === undefined) throw new ShopError("AK_LINE_PRICE", "AK_LINE_PRICE: a free line needs a price");
      lines.push({ description: l.description!, quantity: l.quantity, unitPriceCents: l.unitPriceCents, category: l.category ?? "standard" });
    }
  }
  return issueInvoice(db, { shopId, clientId: input.clientId ?? null, language: input.language, issuedOn: input.issuedOn, termsDays: input.termsDays ?? null, lines, replaces: link.replaces ?? null });
}

/**
 * « Modifier la facture » (#207): an issued invoice never changes, so a correction cancels it with its credit note and issues
 * its replacement — both in one transaction, so the ledger never holds one without the other. Refused for an invoice of
 * another shop, a credit note, and an invoice already credited (corrected or cancelled before).
 */
export async function replaceInvoice(db: Db, shopId: string, originalId: string, raw: InvoiceInput) {
  return db.transaction(async (tx) => {
    const [original] = await tx.select().from(invoices).where(and(eq(invoices.id, originalId), eq(invoices.shopId, shopId))).for("update");
    if (!original) throw new ShopError("AK_INVOICE_UNKNOWN", `AK_INVOICE_UNKNOWN: ${originalId}`);
    if (original.creditOf) throw new ShopError("AK_INVOICE_IS_CREDIT", "AK_INVOICE_IS_CREDIT: a credit note is not corrected");
    const [credited] = await tx.select({ id: invoices.id }).from(invoices).where(eq(invoices.creditOf, originalId)).limit(1);
    if (credited) throw new ShopError("AK_INVOICE_ALREADY_CORRECTED", "AK_INVOICE_ALREADY_CORRECTED: this invoice was already credited");
    const input = invoiceInputSchema.parse(raw);
    const credit = await creditNote(tx, originalId, input.issuedOn);
    const replacement = await issueShopInvoice(tx, shopId, input, { replaces: originalId });
    return { credit: credit.invoice, replacement: replacement.invoice, totals: replacement.totals };
  });
}

/** The shop's invoices, newest first, with the client's name (null for a sale without a client file). */
export async function listInvoices(db: Db, shopId: string) {
  const rows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      issuedOn: invoices.issuedOn,
      dueOn: invoices.dueOn,
      language: invoices.language,
      creditOf: invoices.creditOf,
      subtotalCents: invoices.subtotalCents,
      gstCents: invoices.gstCents,
      qstCents: invoices.qstCents,
      totalCents: invoices.totalCents,
      clientId: invoices.clientId,
      client: clients.fullName,
      clientEmail: clients.email,
      // What was received against it, and whether a credit note or a correction (#207) superseded it (akinaza#218).
      paidCents: sql<number>`coalesce((SELECT sum(p.amount_cents) FROM payments p WHERE p.invoice_id = ${invoices.id}), 0)::int`,
      superseded: sql<boolean>`EXISTS (SELECT 1 FROM invoices o WHERE o.credit_of = ${invoices.id} OR o.replaces = ${invoices.id})`,
    })
    .from(invoices)
    .leftJoin(clients, eq(clients.id, invoices.clientId))
    .where(eq(invoices.shopId, shopId))
    .orderBy(desc(invoices.createdAt), desc(invoices.number));
  return rows;
}

/** One invoice with its lines, its client and the supplier's identity (the numbers a buyer needs for input tax credits); null if it is not this shop's. */
export async function invoiceDetail(db: Db | Tx, shopId: string, invoiceId: string) {
  const [row] = await db
    .select({ invoice: invoices, client: { fullName: clients.fullName, email: clients.email, phone: clients.phone }, shop: { name: shops.name, legalName: shops.legalName, address: shops.address, timezone: shops.timezone, registrant: shops.registrant, gstNumber: shops.gstNumber, qstNumber: shops.qstNumber, publicEmail: shops.publicEmail } })
    .from(invoices)
    .innerJoin(shops, eq(shops.id, invoices.shopId))
    .leftJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(invoices.id, invoiceId), eq(invoices.shopId, shopId)));
  if (!row) return null;
  const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId)).orderBy(invoiceLines.position);
  const { invoice } = row;
  // The chain of a correction (#207): what this invoice replaces, what replaced it, the credit note that cancelled it.
  const ref = { id: invoices.id, number: invoices.number };
  type Ref = { id: string; number: string } | undefined;
  const orNull = (ref: Ref): { id: string; number: string } | null => ref ?? null;
  const [[replaces], [replacedBy], [creditedBy]]: [Ref[], Ref[], Ref[]] = await Promise.all([
    invoice.replaces ? db.select(ref).from(invoices).where(eq(invoices.id, invoice.replaces)) : Promise.resolve([]),
    db.select(ref).from(invoices).where(eq(invoices.replaces, invoice.id)).limit(1),
    db.select(ref).from(invoices).where(eq(invoices.creditOf, invoice.id)).limit(1),
  ]);
  return { id: invoice.id, number: invoice.number, issuedOn: invoice.issuedOn, termsDays: invoice.termsDays, dueOn: invoice.dueOn, language: invoice.language, clientId: invoice.clientId, creditOf: invoice.creditOf, replaces: orNull(replaces), replacedBy: orNull(replacedBy), creditedBy: orNull(creditedBy), subtotalCents: invoice.subtotalCents, gstCents: invoice.gstCents, qstCents: invoice.qstCents, totalCents: invoice.totalCents, client: row.client?.fullName ? row.client : null, shop: row.shop, lines };
}
