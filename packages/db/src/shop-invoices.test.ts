import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { services, shopRules, shops, taxLedger } from "./schema";
import { saveRules } from "./service-shop";
import { creditNote, invoiceDetail, invoiceInputSchema, issueShopInvoice, listInvoices } from "./shop-ops";
import { freshDatabase, refusal } from "./test/db";
import { salon } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

describe("a services business issues an invoice from its own services (real PostgreSQL 16)", () => {
  it("bills hours of a service at its price: the totals of the Québec template, to the cent", async () => {
    const s = await salon(t.db);
    // 10 hours at $150.00 + one licence at $1 500.00 + a support pack at $500.00 = $3 500.00 → GST $175.00, QST $349.13 (349.125 rounds up)
    const hour = s.services.colour.id;
    await t.db.update(services).set({ priceCents: 15_000 }).where(eq(services.id, hour));
    const { invoice, totals } = await issueShopInvoice(t.db, s.shop.id, {
      clientId: s.client.id,
      language: "fr",
      issuedOn: "2026-10-21",
      lines: [
        { serviceId: hour, quantity: 10 },
        { description: "Licence Orazaka On-Premise / On-Premise licence", quantity: 1, unitPriceCents: 150_000 },
        { description: "Support (forfait) / Support (flat fee)", quantity: 1, unitPriceCents: 50_000 },
      ],
    });
    expect(invoice).toMatchObject({ number: "F-00001", subtotalCents: 350_000, gstCents: 17_500, qstCents: 34_913, totalCents: 402_413 });
    expect(totals.lines[0]).toMatchObject({ description: "Coloration / Colour", quantity: 10, unitPriceCents: 15_000, amountCents: 150_000 });
  });

  it("lets a line keep its own price over the service's (a negotiated rate)", async () => {
    const s = await salon(t.db);
    const { totals } = await issueShopInvoice(t.db, s.shop.id, { language: "en", issuedOn: "2026-10-21", lines: [{ serviceId: s.services.cut.id, quantity: 2, unitPriceCents: 4_000 }] });
    expect(totals.lines[0]).toMatchObject({ unitPriceCents: 4_000, amountCents: 8_000 });
  });

  it("refuses a service or a client of another shop, an empty invoice, a free-text line without a price, a fractional quantity", async () => {
    const a = await salon(t.db);
    const b = await salon(t.db);
    expect(await refusal(issueShopInvoice(t.db, a.shop.id, { language: "fr", issuedOn: "2026-10-21", lines: [{ serviceId: b.services.cut.id, quantity: 1 }] }))).toMatch(/AK_SERVICE_UNKNOWN/);
    expect(await refusal(issueShopInvoice(t.db, a.shop.id, { clientId: b.client.id, language: "fr", issuedOn: "2026-10-21", lines: [{ serviceId: a.services.cut.id, quantity: 1 }] }))).toMatch(/AK_CLIENT_UNKNOWN/);
    expect(invoiceInputSchema.safeParse({ language: "fr", issuedOn: "2026-10-21", lines: [] }).success).toBe(false);
    expect(invoiceInputSchema.safeParse({ language: "fr", issuedOn: "2026-10-21", lines: [{ description: "x", quantity: 1 }] }).success).toBe(true);
    expect(await refusal(issueShopInvoice(t.db, a.shop.id, { language: "fr", issuedOn: "2026-10-21", lines: [{ description: "Travail", quantity: 1 }] }))).toMatch(/AK_LINE_PRICE/);
    expect(invoiceInputSchema.safeParse({ language: "fr", issuedOn: "2026-10-21", lines: [{ description: "x", quantity: 7.5, unitPriceCents: 100 }] }).success).toBe(false);
    expect(invoiceInputSchema.safeParse({ language: "fr", issuedOn: "21/10/2026", lines: [{ description: "x", quantity: 1, unitPriceCents: 100 }] }).success).toBe(false);
  });

  it("lists the shop's invoices newest first, with the client, and reads one with its lines — never another shop's", async () => {
    const a = await salon(t.db);
    const b = await salon(t.db);
    const first = await issueShopInvoice(t.db, a.shop.id, { clientId: a.client.id, language: "fr", issuedOn: "2026-10-01", lines: [{ serviceId: a.services.cut.id, quantity: 1 }] });
    const second = await issueShopInvoice(t.db, a.shop.id, { language: "en", issuedOn: "2026-10-02", lines: [{ serviceId: a.services.cut.id, quantity: 3 }] });
    await issueShopInvoice(t.db, b.shop.id, { language: "fr", issuedOn: "2026-10-03", lines: [{ serviceId: b.services.cut.id, quantity: 1 }] });
    const list = await listInvoices(t.db, a.shop.id);
    expect(list.map((i) => i.number)).toEqual(["F-00002", "F-00001"]);
    expect(list[1]).toMatchObject({ client: "Camille Tremblay", totalCents: 5_174 });
    expect(list[0]!.client).toBeNull();
    const detail = await invoiceDetail(t.db, a.shop.id, first.invoice.id);
    expect(detail).toMatchObject({ number: "F-00001", language: "fr", client: { fullName: "Camille Tremblay" }, shop: { legalName: "Salon Laurier inc.", gstNumber: "123456789RT0001", qstNumber: "1234567890TQ0001" } });
    expect(detail!.lines).toHaveLength(1);
    expect(await invoiceDetail(t.db, b.shop.id, second.invoice.id)).toBeNull();
  });
});

describe("the due date and the payment terms of an invoice (krizaka/akinaza#113)", () => {
  const line = (s: Awaited<ReturnType<typeof salon>>) => [{ serviceId: s.services.cut.id, quantity: 1 }];

  it("issues under the shop's own terms (30 days by default) and keeps the due date they give", async () => {
    const s = await salon(t.db);
    const { invoice } = await issueShopInvoice(t.db, s.shop.id, { language: "fr", issuedOn: "2026-10-21", lines: line(s) });
    expect(invoice).toMatchObject({ termsDays: 30, dueOn: "2026-11-20" });
    expect(await invoiceDetail(t.db, s.shop.id, invoice.id)).toMatchObject({ termsDays: 30, dueOn: "2026-11-20" });
    expect((await listInvoices(t.db, s.shop.id))[0]).toMatchObject({ dueOn: "2026-11-20" });
  });

  it("takes the shop's terms as they are when the owner changes them, and the invoice keeps the terms it was issued under", async () => {
    const s = await salon(t.db);
    await t.db.update(shops).set({ paymentTermsDays: 15 }).where(eq(shops.id, s.shop.id));
    const first = await issueShopInvoice(t.db, s.shop.id, { language: "en", issuedOn: "2026-10-21", lines: line(s) });
    await t.db.update(shops).set({ paymentTermsDays: 45 }).where(eq(shops.id, s.shop.id));
    const second = await issueShopInvoice(t.db, s.shop.id, { language: "en", issuedOn: "2026-10-21", lines: line(s) });
    expect(first.invoice).toMatchObject({ termsDays: 15, dueOn: "2026-11-05" });
    expect(second.invoice).toMatchObject({ termsDays: 45, dueOn: "2026-12-05" });
    expect(await invoiceDetail(t.db, s.shop.id, first.invoice.id)).toMatchObject({ termsDays: 15, dueOn: "2026-11-05" });
  });

  it("lets one invoice ask for other terms, including due on receipt", async () => {
    const s = await salon(t.db);
    const net60 = await issueShopInvoice(t.db, s.shop.id, { language: "fr", issuedOn: "2026-10-21", termsDays: 60, lines: line(s) });
    const onReceipt = await issueShopInvoice(t.db, s.shop.id, { language: "fr", issuedOn: "2026-10-21", termsDays: 0, lines: line(s) });
    expect(net60.invoice).toMatchObject({ termsDays: 60, dueOn: "2026-12-20" });
    expect(onReceipt.invoice).toMatchObject({ termsDays: 0, dueOn: "2026-10-21" });
    expect(invoiceInputSchema.safeParse({ language: "fr", issuedOn: "2026-10-21", termsDays: 400, lines: [{ description: "x", quantity: 1, unitPriceCents: 100 }] }).success).toBe(false);
  });

  it("the ledger does not move: the same taxes, whatever the terms", async () => {
    const s = await salon(t.db);
    const a = await issueShopInvoice(t.db, s.shop.id, { language: "fr", issuedOn: "2026-10-21", termsDays: 0, lines: line(s) });
    const b = await issueShopInvoice(t.db, s.shop.id, { language: "fr", issuedOn: "2026-10-21", termsDays: 60, lines: line(s) });
    const entries = async (id: string) => (await t.db.select({ tax: taxLedger.tax, cents: taxLedger.amountCents }).from(taxLedger).where(eq(taxLedger.sourceId, id))).sort((x, y) => x.tax.localeCompare(y.tax));
    expect(await entries(a.invoice.id)).toEqual(await entries(b.invoice.id));
    expect(await entries(a.invoice.id)).toEqual([{ tax: "gst", cents: 225 }, { tax: "qst", cents: 449 }]);
  });

  it("a credit note is not due: it carries no terms", async () => {
    const s = await salon(t.db);
    const { invoice } = await issueShopInvoice(t.db, s.shop.id, { language: "fr", issuedOn: "2026-10-21", lines: line(s) });
    const credit = await creditNote(t.db, invoice.id, "2026-10-22");
    expect(credit.invoice).toMatchObject({ termsDays: null, dueOn: null });
  });

  it("the database refuses a due date that does not follow from the terms, and terms out of bounds", async () => {
    const s = await salon(t.db);
    const insert = (terms: number, due: string) => t.pool.query(`INSERT INTO invoices (shop_id, number, language, issued_on, terms_days, due_on, subtotal_cents, gst_cents, qst_cents, total_cents) VALUES ('${s.shop.id}', 'X-${terms}', 'fr', '2026-10-21', ${terms}, '${due}', 0, 0, 0, 0)`);
    expect(await refusal(insert(30, "2026-10-01"))).toMatch(/invoices_terms/);
    expect(await refusal(insert(30, "2026-11-19"))).toMatch(/invoices_terms/);
    expect(await refusal(insert(400, "2027-11-25"))).toMatch(/invoices_terms/);
    expect(await refusal(t.pool.query(`INSERT INTO invoices (shop_id, number, language, issued_on, terms_days, subtotal_cents, gst_cents, qst_cents, total_cents) VALUES ('${s.shop.id}', 'X-n', 'fr', '2026-10-21', 30, 0, 0, 0, 0)`))).toMatch(/invoices_terms/); // terms without a due date
    expect(await refusal(t.pool.query(`UPDATE shops SET payment_terms_days = 366 WHERE id = '${s.shop.id}'`))).toMatch(/shops_payment_terms/);
  });

  it("the owner's rules carry the shop's terms", async () => {
    const s = await salon(t.db);
    await t.db.insert(shopRules).values({ shopId: s.shop.id });
    await saveRules(t.db, s.shop.id, { cancellationHours: 24, bookingHorizonDays: 60, slotStepMinutes: 30, minNoticeMinutes: 120, reportLinkDays: 30, paymentTermsDays: 0 });
    expect((await t.db.select().from(shops).where(eq(shops.id, s.shop.id)))[0]!.paymentTermsDays).toBe(0);
    const { invoice } = await issueShopInvoice(t.db, s.shop.id, { language: "fr", issuedOn: "2026-10-21", lines: line(s) });
    expect(invoice).toMatchObject({ termsDays: 0, dueOn: "2026-10-21" });
    await expect(saveRules(t.db, s.shop.id, { cancellationHours: 24, bookingHorizonDays: 60, slotStepMinutes: 30, minNoticeMinutes: 120, reportLinkDays: 30, paymentTermsDays: 366 })).rejects.toThrow();
  });
});
