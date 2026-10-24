import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts, clients, dependants, invoices, shops } from "./schema";
import { organizeOver } from "./organize";
import { KRIZAKA, KRIZAKA_EMAILS, KRIZAKA_RENAMED_CLIENTS, renameFormerClients, seedKrizaka } from "./seed-krizaka";
import { invoiceDetail, listInvoices, prepareShopReturn } from "./shop-ops";
import { publicShop, shopsOfOwner } from "./service-shop";
import { freshDatabase } from "./test/db";
import { shopClients } from "./visits";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
  await t.db.insert(accounts).values(KRIZAKA_EMAILS.map((email) => ({ email, passwordHash: "x" })));
});
afterAll(async () => t.drop());

const NOW = new Date("2026-10-21T15:00:00Z"); // Wednesday 11:00 in Montréal; the last completed quarter is 2026-Q3

describe("Krizaka, a software studio, as Akinaza's first client (demo data, clearly marked)", () => {
  it("builds a services business: bookable and invoiceable services, business clients, demo numbers", async () => {
    const first = await seedKrizaka(t.db, NOW);
    expect(first.created).toBe(true);
    const [shop] = await t.db.select().from(shops).where(eq(shops.id, first.shopId));
    expect(shop).toMatchObject({ kind: "services", registrant: true, invoicePrefix: "KZ", slug: "krizaka-demo", businessType: "professional" });
    expect(shop!.legalName).toMatch(/démo/);
    expect(shop!.gstNumber).toBe("123456789RT0001"); // the documented fake numbers, never Krizaka's own
    const page = await publicShop(t.db, "krizaka-demo");
    expect(page?.services.map((s) => s.nameEn)).toEqual(expect.arrayContaining(["Software development (hourly)", "Design (hourly)", "Consulting and architecture (hourly)", "Scoping workshop (flat fee)", "Support and maintenance (monthly flat fee)"]));
    expect(page?.shop.bioEn).toMatch(/demo/i);
    const clients = await shopClients(t.db, first.shopId);
    expect(clients.map((c) => c.fullName).sort()).toEqual(KRIZAKA.clients.map((c) => c.name).sort());
    expect(clients.every((c) => /\(démo\)|\(demo\)/.test(c.fullName))).toBe(true);
  });

  it("gives Éric a second shop, public too, with the first still the one the app opens on — and seeds again without a third", async () => {
    await seedKrizaka(t.db, NOW);
    const [owner] = await t.db.select().from(accounts).where(eq(accounts.email, KRIZAKA_EMAILS[0]));
    const list = await shopsOfOwner(t.db, owner!.id);
    expect(list.map((x) => [x.slug, x.isDefault, x.published])).toEqual([["krizaka-demo", true, true], ["krizaka-atelier", false, true]]);
    expect((await publicShop(t.db, "krizaka-atelier"))?.services.map((s) => s.nameEn)).toEqual(["Design session (hourly)"]);
  });

  it("Éric's shops are items of « organize »: a description, an avatar, a tag, and one collection for both", async () => {
    const [owner] = await t.db.select().from(accounts).where(eq(accounts.email, KRIZAKA_EMAILS[0]));
    const o = organizeOver(async (sql, params) => (await t.pool.query(sql, params as unknown[])).rows);
    const list = await shopsOfOwner(t.db, owner!.id);
    expect(list.every((x) => x.description && x.avatar)).toBe(true);
    expect(new Set(list.map((x) => x.collectionId)).size).toBe(1);
    expect((await o.collections.list(owner!.id)).find((c) => c.id === list[0]!.collectionId)?.name).toBe("Studios");
    expect([...(await o.tags.of(owner!.id, "shop", list.map((x) => x.id))).values()].map((tags) => tags.map((x) => x.name))).toEqual([["démo"], ["démo"]]);
  });

  it("keeps the books of the quarter: bilingual invoices to the cent, a balanced ledger, a return prepared and never filed", async () => {
    const [shop] = await t.db.select().from(shops).where(eq(shops.slug, "krizaka-demo"));
    const list = await listInvoices(t.db, shop!.id);
    expect(list.length).toBeGreaterThanOrEqual(6);
    expect(new Set(list.map((i) => i.language))).toEqual(new Set(["fr", "en"]));
    expect(list.every((i) => i.totalCents === i.subtotalCents + i.gstCents + i.qstCents)).toBe(true);
    const detail = await invoiceDetail(t.db, shop!.id, list[0]!.id);
    expect(detail!.shop.gstNumber).toBe("123456789RT0001");
    // The ledger holds exactly the taxes of the invoices, per tax, over the whole book (the database also checks it at each commit).
    const [sums] = (await t.db.execute(sql`
      SELECT (SELECT coalesce(sum(gst_cents),0)::int FROM invoices WHERE shop_id = ${shop!.id}) AS gst_inv,
             (SELECT coalesce(sum(qst_cents),0)::int FROM invoices WHERE shop_id = ${shop!.id}) AS qst_inv,
             (SELECT coalesce(sum(amount_cents),0)::int FROM tax_ledger WHERE shop_id = ${shop!.id} AND tax = 'gst' AND direction = 'collected') AS gst_led,
             (SELECT coalesce(sum(amount_cents),0)::int FROM tax_ledger WHERE shop_id = ${shop!.id} AND tax = 'qst' AND direction = 'collected') AS qst_led`)).rows as { gst_inv: number; qst_inv: number; gst_led: number; qst_led: number }[];
    expect(sums!.gst_led).toBe(sums!.gst_inv);
    expect(sums!.qst_led).toBe(sums!.qst_inv);
    const q3 = await prepareShopReturn(t.db, shop!.id, "2026-07-01", "2026-09-30");
    expect(q3.lines.find((l) => l.line === "101")!.amountCents).toBeGreaterThan(0);
    expect(q3.gstNetCents).toBeGreaterThan(0); // more collected than the input tax credits of the expenses: a net amount to remit
    expect(q3.qstNetCents).toBeGreaterThan(0);
    expect(q3.preparedOnly).toBe(true);
    expect(JSON.stringify(q3)).not.toMatch(/filed|transmit/i);
  });

  it("is idempotent: a second run adds nothing", async () => {
    const [shop] = await t.db.select().from(shops).where(eq(shops.slug, "krizaka-demo"));
    const before = (await t.db.select().from(invoices).where(eq(invoices.shopId, shop!.id))).length;
    const again = await seedKrizaka(t.db, NOW);
    expect(again.created).toBe(false);
    expect((await t.db.select().from(invoices).where(eq(invoices.shopId, shop!.id))).length).toBe(before);
  });
  it("renames a former demo client in place: same account, same client file, same invoices and numbers (#326)", async () => {
    const [shop] = await t.db.select().from(shops).where(eq(shops.slug, "krizaka-demo"));
    const { from, to } = KRIZAKA_RENAMED_CLIENTS[0]!;
    // The database as it was before the rename: the café's account and client file, its invoices already issued.
    await t.db.update(accounts).set({ email: from.email }).where(eq(accounts.email, to.email));
    await t.db.update(clients).set({ email: from.email, fullName: from.name }).where(eq(clients.email, to.email));
    const [file] = await t.db.select().from(clients).where(eq(clients.email, from.email));
    await t.db.insert(dependants).values({ shopId: shop!.id, clientId: file!.id, kind: "other", name: from.name });
    const before = (await t.db.select({ id: invoices.id, number: invoices.number, clientId: invoices.clientId }).from(invoices).where(eq(invoices.shopId, shop!.id))).sort((a, b) => a.id.localeCompare(b.id));

    await renameFormerClients(t.db);
    await renameFormerClients(t.db); // idempotent
    await seedKrizaka(t.db, NOW);

    expect(await t.db.select().from(accounts).where(eq(accounts.email, from.email))).toHaveLength(0);
    const renamed = await t.db.select().from(clients).where(eq(clients.id, file!.id));
    expect(renamed[0]).toMatchObject({ fullName: to.name, email: to.email });
    expect((await t.db.select().from(dependants).where(eq(dependants.clientId, file!.id))).every((d) => d.name === to.name)).toBe(true);
    expect((await shopClients(t.db, shop!.id)).map((c) => c.fullName).sort()).toEqual(KRIZAKA.clients.map((c) => c.name).sort());
    const after = (await t.db.select({ id: invoices.id, number: invoices.number, clientId: invoices.clientId }).from(invoices).where(eq(invoices.shopId, shop!.id))).sort((a, b) => a.id.localeCompare(b.id));
    expect(after).toEqual(before);
  });
});
