import { createHash } from "node:crypto";

import { addDays } from "date-fns";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

import type { Db } from "./client";
import { ShopError } from "./errors";
import { clients, invoiceDeliveries, invoices, invoiceMailPlatformSettings, mailOutbox, payments, shopMedia, shops } from "./schema";
import { invoiceDetail } from "./shop-ops";

export const invoiceTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const isInvoiceToken = (token: string) => /^iv1\.[A-Za-z0-9_-]{43}$/.test(token);

export interface InvoiceDeliveryMail {
  tokenHash: string;
  toEmail: string;
  ccEmail: string | null;
  fromName: string;
  locale: "fr" | "en";
  expiresAt: Date;
  createdAt: Date;
  subject: string;
  html: string;
  text: string;
}

/** Enqueues one invoice e-mail and creates its per-send link in the same transaction. */
export async function enqueueInvoiceDelivery(db: Db, shopId: string, invoiceId: string, mail: InvoiceDeliveryMail): Promise<{ deliveryId: string; mailId: string }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM shops WHERE id = ${shopId} FOR UPDATE`);
    const [invoice] = await tx
      .select({ id: invoices.id, clientId: invoices.clientId, erasedAt: clients.erasedAt })
      .from(invoices)
      .leftJoin(clients, eq(clients.id, invoices.clientId))
      .where(and(eq(invoices.id, invoiceId), eq(invoices.shopId, shopId)));
    if (!invoice || !invoice.clientId) throw new ShopError("AK_INVOICE_UNKNOWN", `AK_INVOICE_UNKNOWN: ${invoiceId}`);
    if (invoice.erasedAt) throw new ShopError("AK_CLIENT_UNREACHABLE", "AK_CLIENT_UNREACHABLE");
    if (!mail.toEmail.trim()) throw new ShopError("AK_INVOICE_RECIPIENT", "AK_INVOICE_RECIPIENT");

    const [settings] = await tx.select({ maxPerShopPerDay: invoiceMailPlatformSettings.maxPerShopPerDay }).from(invoiceMailPlatformSettings).where(eq(invoiceMailPlatformSettings.id, "global"));
    const dayStart = new Date(Date.UTC(mail.createdAt.getUTCFullYear(), mail.createdAt.getUTCMonth(), mail.createdAt.getUTCDate()));
    const dayEnd = addDays(dayStart, 1);
    const count = await tx.execute(sql`
      SELECT count(*)::int AS count
        FROM invoice_deliveries d JOIN invoices i ON i.id = d.invoice_id
       WHERE i.shop_id = ${shopId}
         AND d.created_at >= ${dayStart.toISOString()}::timestamptz
         AND d.created_at < ${dayEnd.toISOString()}::timestamptz`);
    if ((count.rows[0] as { count: number }).count >= (settings?.maxPerShopPerDay ?? 50)) throw new ShopError("AK_INVOICE_SEND_LIMIT", "AK_INVOICE_SEND_LIMIT");

    const [delivery] = await tx
      .insert(invoiceDeliveries)
      .values({ invoiceId, viewTokenHash: mail.tokenHash, toEmail: mail.toEmail, expiresAt: mail.expiresAt, createdAt: mail.createdAt })
      .returning({ id: invoiceDeliveries.id });
    const [queued] = await tx.insert(mailOutbox).values({
      toEmail: mail.toEmail,
      ccEmail: mail.ccEmail,
      fromName: mail.fromName,
      locale: mail.locale,
      template: "invoice-issued",
      subject: mail.subject,
      html: mail.html,
      bodyText: mail.text,
      relatedKind: "invoice_delivery",
      relatedId: delivery!.id,
      createdAt: mail.createdAt,
    }).returning({ id: mailOutbox.id });
    return { deliveryId: delivery!.id, mailId: queued!.id };
  });
}

/** Opens a live link once and returns only the invoice it names. */
export async function invoiceByToken(db: Db, token: string, now: Date) {
  if (!isInvoiceToken(token)) return null;
  const hash = invoiceTokenHash(token);
  const found = await db
    .select({ id: invoiceDeliveries.id, invoiceId: invoices.id, shopId: invoices.shopId })
    .from(invoiceDeliveries)
    .innerJoin(invoices, eq(invoices.id, invoiceDeliveries.invoiceId))
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(invoiceDeliveries.viewTokenHash, hash), sql`${invoiceDeliveries.expiresAt} > ${now.toISOString()}::timestamptz`, isNull(invoiceDeliveries.revokedAt), isNull(clients.erasedAt)))
    .limit(1);
  const delivery = found[0];
  if (!delivery) return null;
  await db.update(invoiceDeliveries).set({ openedAt: now }).where(and(eq(invoiceDeliveries.id, delivery.id), isNull(invoiceDeliveries.openedAt)));
  const invoice = await invoiceDetail(db, delivery.shopId, delivery.invoiceId);
  if (!invoice) return null;
  const [received] = await db.select({ paidCents: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` }).from(payments).where(eq(payments.invoiceId, delivery.invoiceId));
  return { ...invoice, paidCents: received?.paidCents ?? 0 };
}

/** A delivery link may also open only the replacement explicitly named by the invoice it was issued for. */
export async function invoiceReplacementByToken(db: Db, token: string, replacementId: string, now: Date) {
  const original = await invoiceByToken(db, token, now);
  if (!original?.replacedBy || original.replacedBy.id !== replacementId) return null;
  const [owner] = await db.select({ shopId: invoices.shopId }).from(invoices).where(eq(invoices.id, original.id));
  if (!owner) return null;
  const replacement = await invoiceDetail(db, owner.shopId, replacementId);
  if (!replacement) return null;
  const [received] = await db.select({ paidCents: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` }).from(payments).where(eq(payments.invoiceId, replacementId));
  return { ...replacement, paidCents: received?.paidCents ?? 0 };
}

/** The invoice's send history; recipient data is blanked when a client is erased. */
export async function invoiceDeliveryHistory(db: Db, shopId: string, invoiceId: string) {
  return db
    .select({
      id: invoiceDeliveries.id,
      toEmail: invoiceDeliveries.toEmail,
      createdAt: invoiceDeliveries.createdAt,
      expiresAt: invoiceDeliveries.expiresAt,
      openedAt: invoiceDeliveries.openedAt,
      revokedAt: invoiceDeliveries.revokedAt,
      mailStatus: mailOutbox.status,
      sentAt: mailOutbox.sentAt,
    })
    .from(invoiceDeliveries)
    .innerJoin(invoices, eq(invoices.id, invoiceDeliveries.invoiceId))
    .leftJoin(mailOutbox, and(eq(mailOutbox.relatedId, invoiceDeliveries.id), eq(mailOutbox.relatedKind, "invoice_delivery")))
    .where(and(eq(invoices.id, invoiceId), eq(invoices.shopId, shopId)))
    .orderBy(desc(invoiceDeliveries.createdAt));
}

/** Invoices in the signed-in client's own shop files. */
export async function clientInvoices(db: Db, clientId: string) {
  return db
    .select({
      id: invoices.id,
      number: invoices.number,
      issuedOn: invoices.issuedOn,
      dueOn: invoices.dueOn,
      language: invoices.language,
      totalCents: invoices.totalCents,
      paidCents: sql<number>`coalesce((SELECT sum(p.amount_cents) FROM payments p WHERE p.invoice_id = ${invoices.id}), 0)::int`,
      creditOf: invoices.creditOf,
      replaces: invoices.replaces,
      shopId: invoices.shopId,
      shopName: shops.name,
    })
    .from(invoices)
    .innerJoin(shops, eq(shops.id, invoices.shopId))
    .where(eq(invoices.clientId, clientId))
    .orderBy(desc(invoices.createdAt));
}

/** A client's account may read only invoices belonging to one of its un-erased shop files. */
export async function invoiceForClientAccount(db: Db, accountId: string, invoiceId: string) {
  const [row] = await db
    .select({ shopId: invoices.shopId, invoiceId: invoices.id })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(invoices.id, invoiceId), eq(clients.accountId, accountId), isNull(clients.erasedAt)));
  if (!row) return null;
  const invoice = await invoiceDetail(db, row.shopId, row.invoiceId);
  if (!invoice) return null;
  const [received] = await db.select({ paidCents: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` }).from(payments).where(eq(payments.invoiceId, row.invoiceId));
  return { ...invoice, paidCents: received?.paidCents ?? 0 };
}

export async function invoiceMailSettings(db: Db, shopId: string) {
  const [[shop], [platform], [logo]] = await Promise.all([
    db.select({ message: shops.invoiceMailMessage, fromName: shops.invoiceMailFromName, copy: shops.invoiceMailCopy, linkDays: shops.invoiceLinkDays, publicEmail: shops.publicEmail }).from(shops).where(eq(shops.id, shopId)),
    db.select().from(invoiceMailPlatformSettings).where(eq(invoiceMailPlatformSettings.id, "global")),
    db.select({ url: shopMedia.url }).from(shopMedia).where(and(eq(shopMedia.shopId, shopId), eq(shopMedia.role, "cover"))).limit(1),
  ]);
  return shop ? { shop, platform: platform ?? { maxPerShopPerDay: 50, allowedSenderDomain: null }, logo: logo?.url ?? null } : null;
}
