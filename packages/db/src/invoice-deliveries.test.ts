import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { invoiceDeliveries, mailOutbox } from "./schema";
import { enqueueInvoiceDelivery, invoiceByToken, invoiceDeliveryHistory, invoiceTokenHash } from "./invoice-deliveries";
import { eraseClient, issueShopInvoice } from "./shop-ops";
import { freshDatabase } from "./test/db";
import { salon } from "./test/fixtures";

const NOW = new Date("2026-10-23T12:00:00.000Z");
let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => { t = await freshDatabase(); });
afterAll(async () => t.drop());

describe("private invoice delivery links", () => {
  it("queues exactly one mail atomically and opens only the invoice named by its per-send token", async () => {
    const shop = await salon(t.db);
    const sent = await issueShopInvoice(t.db, shop.shop.id, {
      clientId: shop.client.id,
      language: "fr",
      issuedOn: "2026-10-23",
      lines: [{ serviceId: shop.services.cut.id, quantity: 1 }],
    });
    const other = await issueShopInvoice(t.db, shop.shop.id, {
      clientId: shop.client.id,
      language: "fr",
      issuedOn: "2026-10-23",
      lines: [{ serviceId: shop.services.cut.id, quantity: 2 }],
    });
    const token = `iv1.${"A".repeat(43)}`;
    const created = await enqueueInvoiceDelivery(t.db, shop.shop.id, sent.invoice.id, {
      tokenHash: invoiceTokenHash(token),
      toEmail: "billing@example.com",
      ccEmail: null,
      fromName: "Salon Laurier",
      locale: "fr",
      expiresAt: new Date("2026-11-22T12:00:00.000Z"),
      createdAt: NOW,
      maxPerShopPerDay: 50,
      subject: "Votre facture",
      html: "<p>Facture</p>",
      text: "Facture",
    });

    const outbox = await t.db.select().from(mailOutbox).where(eq(mailOutbox.id, created.mailId));
    const delivery = await t.db.select().from(invoiceDeliveries).where(eq(invoiceDeliveries.id, created.deliveryId));
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ toEmail: "billing@example.com", template: "invoice-issued", relatedKind: "invoice_delivery", relatedId: created.deliveryId, status: "pending" });
    expect(delivery[0]).toMatchObject({ invoiceId: sent.invoice.id, viewTokenHash: invoiceTokenHash(token), toEmail: "billing@example.com" });
    expect(JSON.stringify(delivery)).not.toContain(token);

    const opened = await invoiceByToken(t.db, token, NOW);
    expect(opened).toMatchObject({ id: sent.invoice.id, number: sent.invoice.number, paidCents: 0 });
    expect(opened?.id).not.toBe(other.invoice.id);
    expect(await invoiceByToken(t.db, "iv1.invalid", NOW)).toBeNull();
    expect((await invoiceDeliveryHistory(t.db, shop.shop.id, sent.invoice.id))[0]?.openedAt).toEqual(NOW);
  });

  it("rejects expired or revoked links", async () => {
    const shop = await salon(t.db);
    const { invoice } = await issueShopInvoice(t.db, shop.shop.id, {
      clientId: shop.client.id,
      language: "en",
      issuedOn: "2026-10-23",
      lines: [{ serviceId: shop.services.cut.id, quantity: 1 }],
    });
    const expired = `iv1.${"B".repeat(43)}`;
    const revoked = `iv1.${"C".repeat(43)}`;
    const make = (token: string, expiresAt: Date, revokedAt: Date | null) =>
      t.db.insert(invoiceDeliveries).values({ invoiceId: invoice.id, viewTokenHash: invoiceTokenHash(token), toEmail: "client@example.com", createdAt: NOW, expiresAt, revokedAt });
    await make(expired, new Date("2026-10-23T11:59:59.000Z"), null);
    await make(revoked, new Date("2026-11-23T12:00:00.000Z"), NOW);
    expect(await invoiceByToken(t.db, expired, NOW)).toBeNull();
    expect(await invoiceByToken(t.db, revoked, NOW)).toBeNull();
  });

  it("revokes delivery links and removes their queued mail when the client is erased", async () => {
    const shop = await salon(t.db);
    const { invoice } = await issueShopInvoice(t.db, shop.shop.id, {
      clientId: shop.client.id,
      language: "en",
      issuedOn: "2026-10-23",
      lines: [{ serviceId: shop.services.cut.id, quantity: 1 }],
    });
    const token = `iv1.${"D".repeat(43)}`;
    const created = await enqueueInvoiceDelivery(t.db, shop.shop.id, invoice.id, {
      tokenHash: invoiceTokenHash(token),
      toEmail: "client@example.com",
      ccEmail: null,
      fromName: "Salon Laurier",
      locale: "en",
      expiresAt: new Date("2026-11-22T12:00:00.000Z"),
      createdAt: NOW,
      maxPerShopPerDay: 50,
      subject: "Your invoice",
      html: "<p>Invoice</p>",
      text: "Invoice",
    });

    expect(await eraseClient(t.db, shop.client.id, "2026-10-17")).toBe(true);
    expect(await invoiceByToken(t.db, token, NOW)).toBeNull();
    expect(await t.db.select().from(mailOutbox).where(eq(mailOutbox.id, created.mailId))).toHaveLength(0);
    const [delivery] = await t.db.select().from(invoiceDeliveries).where(eq(invoiceDeliveries.id, created.deliveryId));
    expect(delivery).toMatchObject({ toEmail: "—" });
    expect(delivery?.revokedAt).not.toBeNull();
  });

  it("refuses a send past the platform's daily limit, per shop", async () => {
    const shop = await salon(t.db);
    const { invoice } = await issueShopInvoice(t.db, shop.shop.id, {
      clientId: shop.client.id,
      language: "en",
      issuedOn: "2026-10-23",
      lines: [{ serviceId: shop.services.cut.id, quantity: 1 }],
    });
    const mail = (letter: string, maxPerShopPerDay: number) => ({
      tokenHash: invoiceTokenHash(`iv1.${letter.repeat(43)}`),
      toEmail: "client@example.com",
      ccEmail: null,
      fromName: "Salon Laurier",
      locale: "en" as const,
      expiresAt: new Date("2026-11-22T12:00:00.000Z"),
      createdAt: NOW,
      maxPerShopPerDay,
      subject: "Your invoice",
      html: "<p>Invoice</p>",
      text: "Invoice",
    });
    await enqueueInvoiceDelivery(t.db, shop.shop.id, invoice.id, mail("E", 1));
    await expect(enqueueInvoiceDelivery(t.db, shop.shop.id, invoice.id, mail("F", 1))).rejects.toMatchObject({ code: "AK_INVOICE_SEND_LIMIT" });
    await expect(enqueueInvoiceDelivery(t.db, shop.shop.id, invoice.id, mail("G", 2))).resolves.toHaveProperty("deliveryId");
  });
});
