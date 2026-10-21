import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { services } from "./schema";
import { invoiceDetail, invoiceInputSchema, issueShopInvoice, listInvoices } from "./shop-ops";
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
