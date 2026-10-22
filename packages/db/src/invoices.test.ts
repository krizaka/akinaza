import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { creditNote, issueInvoice, prepareShopReturn, recordExpense } from "./shop-ops";
import { invoiceLines, invoices, shops, taxLedger } from "./schema";
import { freshDatabase, refusal } from "./test/db";
import { salon } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const cut = { description: "Coupe / Haircut", quantity: 1, unitPriceCents: 4_500, category: "standard" as const };

describe("invoices and the GST/QST ledger (real PostgreSQL 16)", () => {
  it("issues a bilingual invoice with GST 5 % and QST 9.975 % in whole cents, numbered without gaps", async () => {
    const s = await salon(t.db);
    const a = await issueInvoice(t.db, { shopId: s.shop.id, clientId: s.client.id, language: "fr", issuedOn: "2026-10-15", lines: [cut, { ...cut, description: "Coloration / Colour", unitPriceCents: 9_500 }] });
    expect(a.invoice).toMatchObject({ number: "F-00001", subtotalCents: 14_000, gstCents: 700, qstCents: 1_397, totalCents: 16_097 });
    const b = await issueInvoice(t.db, { shopId: s.shop.id, language: "en", issuedOn: "2026-10-15", lines: [cut] });
    expect(b.invoice).toMatchObject({ number: "F-00002", gstCents: 225, qstCents: 449, totalCents: 5_174 });
    const ledger = await t.db.select().from(taxLedger).where(eq(taxLedger.sourceId, a.invoice.id));
    expect(ledger.map((e) => [e.tax, e.direction, e.amountCents, e.period])).toEqual([
      ["gst", "collected", 700, "2026-10-01"],
      ["qst", "collected", 1_397, "2026-10-01"],
    ]);
  });

  it("numbers invoices without a duplicate under concurrency (the shop row is locked)", async () => {
    const s = await salon(t.db);
    const issued = await Promise.all(Array.from({ length: 8 }, () => issueInvoice(t.db, { shopId: s.shop.id, language: "fr", issuedOn: "2026-10-16", lines: [cut] })));
    expect(new Set(issued.map((i) => i.invoice.number)).size).toBe(8);
    expect(issued.map((i) => i.invoice.number).sort()).toEqual(Array.from({ length: 8 }, (_, i) => `F-${String(i + 1).padStart(5, "0")}`));
  });

  it("refuses, at commit, an invoice whose ledger does not hold its taxes", async () => {
    const s = await salon(t.db);
    const attempt = t.db.transaction(async (tx) => {
      const [inv] = await tx.insert(invoices).values({ shopId: s.shop.id, number: "X-1", language: "fr", issuedOn: "2026-10-15", subtotalCents: 4_500, gstCents: 225, qstCents: 449, totalCents: 5_174 }).returning();
      await tx.insert(invoiceLines).values({ invoiceId: inv!.id, position: 1, description: "Coupe", quantityHundredths: 100, unitPriceCents: 4_500, taxCategory: "standard", amountCents: 4_500 });
      await tx.insert(taxLedger).values({ shopId: s.shop.id, period: "2026-10-01", tax: "gst", direction: "collected", amountCents: 225, sourceKind: "invoice", sourceId: inv!.id, sourceLabel: "X-1" });
      // The QST entry is "forgotten".
    });
    expect(await refusal(attempt)).toMatch(/AK_LEDGER_UNBALANCED/);
    expect(await t.db.select().from(invoices).where(eq(invoices.number, "X-1"))).toHaveLength(0);
  });

  it("refuses an invoice whose lines do not make its subtotal, or whose total is not subtotal + taxes", async () => {
    const s = await salon(t.db);
    expect(
      await refusal(
        t.db.transaction(async (tx) => {
          await tx.insert(invoices).values({ shopId: s.shop.id, number: "X-2", language: "fr", issuedOn: "2026-10-15", subtotalCents: 0, gstCents: 0, qstCents: 0, totalCents: 1 });
        }),
      ),
    ).toMatch(/invoices_total/);
    expect(
      await refusal(
        t.db.transaction(async (tx) => {
          await tx.insert(invoices).values({ shopId: s.shop.id, number: "X-3", language: "fr", issuedOn: "2026-10-15", subtotalCents: 100, gstCents: 0, qstCents: 0, totalCents: 100 });
        }),
      ),
    ).toMatch(/AK_INVOICE_LINES/);
  });

  it("never edits an issued invoice or a ledger entry; a credit note reverses both", async () => {
    const s = await salon(t.db);
    const { invoice } = await issueInvoice(t.db, { shopId: s.shop.id, language: "fr", issuedOn: "2026-10-15", lines: [cut] });
    expect(await refusal(t.db.update(invoices).set({ totalCents: 1 }).where(eq(invoices.id, invoice.id)))).toMatch(/AK_WRITTEN_ONCE/);
    expect(await refusal(t.db.delete(taxLedger).where(eq(taxLedger.sourceId, invoice.id)))).toMatch(/AK_WRITTEN_ONCE/);
    const credit = await creditNote(t.db, invoice.id, "2026-10-20");
    expect(credit.invoice).toMatchObject({ creditOf: invoice.id, subtotalCents: -4_500, gstCents: -225, qstCents: -449, totalCents: -5_174 });
    const [{ gst, qst } = { gst: -1, qst: -1 }] = (await t.db.execute(sql`SELECT sum(amount_cents) FILTER (WHERE tax = 'gst')::int AS gst, sum(amount_cents) FILTER (WHERE tax = 'qst')::int AS qst FROM tax_ledger WHERE shop_id = ${s.shop.id}`)).rows as { gst: number; qst: number }[];
    expect([gst, qst]).toEqual([0, 0]);
  });

  it("charges no tax for a small supplier, and refuses a registrant without valid tax numbers", async () => {
    const s = await salon(t.db, { registrant: false });
    const { invoice } = await issueInvoice(t.db, { shopId: s.shop.id, language: "fr", issuedOn: "2026-10-15", lines: [cut] });
    expect(invoice).toMatchObject({ gstCents: 0, qstCents: 0, totalCents: 4_500 });
    expect(await t.db.select().from(taxLedger).where(eq(taxLedger.sourceId, invoice.id))).toHaveLength(0);
    expect(await refusal(t.db.update(shops).set({ registrant: true }).where(eq(shops.id, s.shop.id)))).toMatch(/shops_tax_numbers/);
  });

  it("refuses a restaurant, a café, a bar or a bakery: they must bill through a certified SRM (MEV-WEB)", async () => {
    for (const kind of ["cafe", "bakery"]) {
      expect(await refusal(t.db.execute(sql`INSERT INTO shops (name, legal_name, kind, registrant, address) VALUES ('Shop', 'Shop inc.', ${kind}, false, 'Montréal')`))).toMatch(/shops_kind/);
    }
    expect(await refusal(t.db.execute(sql`INSERT INTO shops (name, legal_name, kind, registrant, address) VALUES ('Bistro', 'Bistro inc.', 'restaurant', false, 'Montréal')`))).toMatch(/shops_kind/);
    expect(await refusal(t.db.execute(sql`INSERT INTO shops (name, legal_name, kind, registrant, address) VALUES ('Le Bar', 'Le Bar inc.', 'bar', false, 'Montréal')`))).toMatch(/shops_kind/);
  });

  it("prepares the period's return from the ledger: collected − credits = net, with the working papers", async () => {
    const s = await salon(t.db);
    await issueInvoice(t.db, { shopId: s.shop.id, language: "fr", issuedOn: "2026-10-02", lines: [cut] });
    await issueInvoice(t.db, { shopId: s.shop.id, language: "fr", issuedOn: "2026-11-02", lines: [cut] });
    await recordExpense(t.db, { shopId: s.shop.id, supplier: "Fournisseur Beauté inc.", paidOn: "2026-10-05", subtotalCents: 2_400, gstCents: 120, qstCents: 239 });
    await recordExpense(t.db, { shopId: s.shop.id, supplier: "Vidéotron", paidOn: "2026-10-09", subtotalCents: 8_020, gstCents: 401, qstCents: 800, businessSharePct: 50 });
    const r = await prepareShopReturn(t.db, s.shop.id, "2026-10-01", "2026-10-31");
    const line = (code: string) => r.lines.find((l) => l.line === code)!;
    expect(line("101").amountCents).toBe(4_500);
    expect(line("103").amountCents).toBe(225);
    expect(line("106")).toMatchObject({ amountCents: 120 + 201 });
    expect(line("106").sources.map((x) => x.label)).toEqual(["Fournisseur Beauté inc.", "Vidéotron"]);
    expect(line("109").amountCents).toBe(225 - 321);
    expect(line("203").amountCents - line("206").amountCents).toBe(line("209").amountCents);
    expect(r.preparedOnly).toBe(true);
  });

  it("refuses a ledger entry that does not match its source (another month, another shop)", async () => {
    const s = await salon(t.db);
    const e = await recordExpense(t.db, { shopId: s.shop.id, supplier: "X", paidOn: "2026-10-05", subtotalCents: 100, gstCents: 5, qstCents: 10 });
    expect(await refusal(t.db.insert(taxLedger).values({ shopId: s.shop.id, period: "2026-11-01", tax: "gst", direction: "credit", amountCents: 5, sourceKind: "expense", sourceId: e.id, sourceLabel: "X" }))).toMatch(/AK_LEDGER_SOURCE/);
  });
});
