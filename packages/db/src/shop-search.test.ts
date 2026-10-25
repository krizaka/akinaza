import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { clients } from "./schema";
import { book, issueShopInvoice } from "./shop-ops";
import { frameCounts, searchShop } from "./shop-search";
import { freshDatabase } from "./test/db";
import { salon } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
let a: Awaited<ReturnType<typeof salon>>;
let b: Awaited<ReturnType<typeof salon>>;
beforeAll(async () => {
  t = await freshDatabase();
  a = await salon(t.db);
  b = await salon(t.db);
  await t.db.insert(clients).values([
    { shopId: a.shop.id, fullName: "Studio Lumen inc.", language: "fr" },
    // Another shop's client of the same name: the search of shop A never shows it.
    { shopId: b.shop.id, fullName: "Studio Lumière", language: "fr" },
  ]);
});
afterAll(async () => t.drop());

describe("the palette's search (⌘K): the shop's clients and invoices, never another shop's (real PostgreSQL 16)", () => {
  it("finds the shop's clients by a part of their name, whatever the case typed", async () => {
    const found = await searchShop(t.db, a.shop.id, "lum");
    expect(found.clients.map((c) => c.fullName)).toEqual(["Studio Lumen inc."]);
    expect((await searchShop(t.db, a.shop.id, "TREMBLAY")).clients.map((c) => c.fullName)).toEqual(["Camille Tremblay"]);
  });

  it("never returns another shop's client or invoice, even when the other shop's name matches better", async () => {
    await issueShopInvoice(t.db, b.shop.id, { clientId: b.client.id, language: "fr", issuedOn: "2026-10-21", lines: [{ serviceId: b.services.cut.id, quantity: 1 }] });
    const found = await searchShop(t.db, a.shop.id, "Lumière");
    expect(found.clients).toEqual([]);
    expect((await searchShop(t.db, a.shop.id, "Camille")).invoices).toEqual([]);
  });

  it("finds an invoice by its number or its client's name, newest first", async () => {
    const first = await issueShopInvoice(t.db, a.shop.id, { clientId: a.client.id, language: "fr", issuedOn: "2026-10-21", lines: [{ serviceId: a.services.cut.id, quantity: 1 }] });
    const second = await issueShopInvoice(t.db, a.shop.id, { clientId: a.client.id, language: "fr", issuedOn: "2026-10-22", lines: [{ serviceId: a.services.cut.id, quantity: 1 }] });
    const byName = await searchShop(t.db, a.shop.id, "camille");
    expect(byName.invoices.map((i) => i.number)).toEqual([second.invoice.number, first.invoice.number]);
    expect(byName.invoices[0]).toMatchObject({ id: second.invoice.id, client: "Camille Tremblay" });
    expect((await searchShop(t.db, a.shop.id, first.invoice.number)).invoices.map((i) => i.id)).toEqual([first.invoice.id]);
  });

  it("reads a % or a _ as itself, and answers nothing for an empty query", async () => {
    expect((await searchShop(t.db, a.shop.id, "%")).clients).toEqual([]);
    expect((await searchShop(t.db, a.shop.id, "_")).clients).toEqual([]);
    expect(await searchShop(t.db, a.shop.id, "   ")).toEqual({ clients: [], invoices: [] });
  });
});

describe("the rail's counts: the day's appointments and the invoices still to collect, the shop's own", () => {
  it("counts the day's appointments (not the cancelled ones, not another day's) and the invoices with money owed", async () => {
    const base = await frameCounts(t.db, a.shop.id, { day: "2026-10-23" });
    // 2026-10-23 10:00 and 14:00 in Montréal, then the next day: only the first two are the day's.
    for (const at of ["2026-10-23T14:00:00Z", "2026-10-23T18:00:00Z", "2026-10-24T14:00:00Z"]) await book(t.db, { shopId: a.shop.id, staffId: a.staff.julie.id, serviceId: a.services.cut.id, clientId: a.client.id, startsAt: new Date(at) });
    await book(t.db, { shopId: b.shop.id, staffId: b.staff.julie.id, serviceId: b.services.cut.id, startsAt: new Date("2026-10-23T15:00:00Z") });
    const counts = await frameCounts(t.db, a.shop.id, { day: "2026-10-23" });
    expect(counts.appointments).toBe(base.appointments + 2);
    // The two invoices of shop A above, unpaid: both still to collect; shop B's is not counted.
    expect(counts.toCollect).toBe(2);
    expect((await frameCounts(t.db, b.shop.id, { day: "2026-10-23" })).toCollect).toBe(1);
  });
});
