import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { invoices } from "./schema";
import { issueShopInvoice, replaceInvoice } from "./shop-ops";
import { freshDatabase } from "./test/db";
import { salon } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const line = (unitPriceCents: number, description = "Balayage") => ({ description, quantity: 1, unitPriceCents });

describe("« Modifier la facture » (real PostgreSQL 16, #207)", () => {
  it("credits the original and issues its replacement in one go: the original never changes, the ledger balances", async () => {
    const s = await salon(t.db);
    const { invoice: original } = await issueShopInvoice(t.db, s.shop.id, { clientId: s.client.id, language: "fr", issuedOn: "2026-10-21", lines: [line(22000)] });
    const before = JSON.stringify(await t.db.select().from(invoices).where(eq(invoices.id, original.id)));
    const done = await replaceInvoice(t.db, s.shop.id, original.id, { clientId: s.client.id, language: "fr", issuedOn: "2026-10-22", lines: [line(20000), line(1500, "Soin")] });
    expect(done.credit.creditOf).toBe(original.id);
    expect(done.credit.totalCents).toBe(-original.totalCents);
    expect(done.replacement.replaces).toBe(original.id);
    expect(done.replacement.subtotalCents).toBe(21500);
    expect(JSON.stringify(await t.db.select().from(invoices).where(eq(invoices.id, original.id)))).toBe(before);
    // Original + credit cancel out: the shop's collected taxes are the replacement's alone.
    const [ledger] = (await t.db.execute(sql`SELECT sum(amount_cents)::int AS total FROM tax_ledger WHERE shop_id = ${s.shop.id}`)).rows as { total: number }[];
    expect(ledger!.total).toBe(done.replacement.gstCents + done.replacement.qstCents);
  });

  it("refuses a second correction of the same invoice, a credit note, and another shop's invoice", async () => {
    const s = await salon(t.db);
    const other = await salon(t.db);
    const { invoice: original } = await issueShopInvoice(t.db, s.shop.id, { language: "fr", issuedOn: "2026-10-21", lines: [line(5000)] });
    const first = await replaceInvoice(t.db, s.shop.id, original.id, { language: "fr", issuedOn: "2026-10-22", lines: [line(4500)] });
    await expect(replaceInvoice(t.db, s.shop.id, original.id, { language: "fr", issuedOn: "2026-10-22", lines: [line(4000)] })).rejects.toMatchObject({ code: "AK_INVOICE_ALREADY_CORRECTED" });
    await expect(replaceInvoice(t.db, s.shop.id, first.credit.id, { language: "fr", issuedOn: "2026-10-22", lines: [line(1)] })).rejects.toMatchObject({ code: "AK_INVOICE_IS_CREDIT" });
    await expect(replaceInvoice(t.db, other.shop.id, first.replacement.id, { language: "fr", issuedOn: "2026-10-22", lines: [line(1)] })).rejects.toMatchObject({ code: "AK_INVOICE_UNKNOWN" });
    // The replacement can itself be corrected later.
    const again = await replaceInvoice(t.db, s.shop.id, first.replacement.id, { language: "fr", issuedOn: "2026-10-23", lines: [line(4200)] });
    expect(again.replacement.replaces).toBe(first.replacement.id);
  });

  it("leaves nothing behind when the replacement is refused (one transaction)", async () => {
    const s = await salon(t.db);
    const { invoice: original } = await issueShopInvoice(t.db, s.shop.id, { language: "fr", issuedOn: "2026-10-21", lines: [line(5000)] });
    await expect(replaceInvoice(t.db, s.shop.id, original.id, { language: "fr", issuedOn: "2026-10-22", lines: [{ description: "Sans prix", quantity: 1 }] })).rejects.toMatchObject({ code: "AK_LINE_PRICE" });
    expect(await t.db.select().from(invoices).where(eq(invoices.creditOf, original.id))).toEqual([]);
  });
});
