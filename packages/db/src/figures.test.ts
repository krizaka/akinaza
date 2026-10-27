import { computeFigures, DEFAULT_FIGURE_THRESHOLDS, nextActions } from "@akinaza/core";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { figuresSnapshot } from "./figures";
import { appointments, daysOff, payments, schedules, shops } from "./schema";
import { book, creditNote, issueInvoice, recordExpense } from "./shop-ops";
import { freshDatabase } from "./test/db";
import { salon } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const AT = { today: "2026-10-23", computedAt: "2026-10-23T16:00:00.000Z", period: { start: "2026-10-01", end: "2026-12-31" } };

describe("the owner's figures read the ledger and the shop's rows in its own calendar (real PostgreSQL 16)", () => {
  it("gives every invoice with what was paid, the payments, the expenses and the appointments of the period", async () => {
    const s = await salon(t.db);
    await t.db.update(shops).set({ timezone: "America/Montreal" }).where(eq(shops.id, s.shop.id));
    const { invoice: a } = await issueInvoice(t.db, { shopId: s.shop.id, clientId: s.client.id, language: "fr", issuedOn: "2026-10-03", termsDays: 7, lines: [{ description: "Coupe", quantity: 1, unitPriceCents: 10_000, category: "standard" }] });
    const { invoice: b } = await issueInvoice(t.db, { shopId: s.shop.id, language: "fr", issuedOn: "2026-10-05", lines: [{ description: "Coloration", quantity: 1, unitPriceCents: 20_000, category: "standard" }] });
    // A payment received at 23:30 Montréal on 2026-10-05 is already the 6th in UTC: it counts on the 5th, the shop's day.
    await t.db.insert(payments).values({ invoiceId: a.id, method: "cash", amountCents: 5_000, receivedAt: new Date("2026-10-06T03:30:00Z") });
    await t.db.insert(payments).values({ invoiceId: b.id, method: "card", amountCents: b.totalCents, receivedAt: new Date("2026-10-20T15:00:00Z") });
    await creditNote(t.db, b.id, "2026-10-12");
    await recordExpense(t.db, { shopId: s.shop.id, supplier: "Fournitures", paidOn: "2026-10-05", subtotalCents: 8_000, gstCents: 400, qstCents: 798, businessSharePct: 50 });
    const done = await book(t.db, { shopId: s.shop.id, staffId: s.staff.julie.id, serviceId: s.services.cut.id, clientId: s.client.id, startsAt: new Date("2026-10-08T14:00:00Z") });
    const missed = await book(t.db, { shopId: s.shop.id, staffId: s.staff.julie.id, serviceId: s.services.cut.id, startsAt: new Date("2026-10-09T14:00:00Z") });
    await t.db.update(appointments).set({ status: "done" }).where(eq(appointments.id, done.id));
    await t.db.update(appointments).set({ status: "noShow" }).where(eq(appointments.id, missed.id));
    // Outside the period: a visit in September.
    await book(t.db, { shopId: s.shop.id, staffId: s.staff.julie.id, serviceId: s.services.cut.id, startsAt: new Date("2026-09-08T14:00:00Z") });

    const { input } = await figuresSnapshot(t.db, s.shop.id, AT);
    const byNumber = Object.fromEntries(input.invoices.map((i) => [i.number, i]));
    expect(input.invoices).toHaveLength(3);
    expect(byNumber[a.number]).toMatchObject({ subtotalCents: 10_000, paidCents: 5_000, dueOn: "2026-10-10", isCredit: false, superseded: false });
    // The credit note cancels the second invoice: that one is superseded, the note is a credit.
    expect(byNumber[b.number]).toMatchObject({ superseded: true, isCredit: false });
    expect(input.invoices.filter((i) => i.isCredit)).toHaveLength(1);
    expect(input.payments.map((p) => p.receivedOn)).toEqual(["2026-10-05", "2026-10-20"]);
    expect(input.expenses).toEqual([{ id: expect.any(String), supplier: "Fournitures", paidOn: "2026-10-05", subtotalCents: 8_000, gstCents: 400, qstCents: 798, businessSharePct: 50 }]);
    expect(input.appointments.map((x) => x.status)).toEqual(["done", "noShow"]);

    // The core computes from it, exactly: 100 $ + the cancelled 200 $ and its credit note (-200 $) = 100 $ invoiced; margin 100 - 40 = 60 $.
    const figures = computeFigures(input, DEFAULT_FIGURE_THRESHOLDS);
    expect(figures.invoiced.value).toBe(10_000);
    expect(figures.margin.value).toBe(6_000);
    expect(figures.toCollect.value).toBe(a.totalCents - 5_000);
    expect(figures.noShows.rate).toBe(50);
  });

  it("counts how often each working block was offered and booked, a day off and a cancelled visit excluded", async () => {
    const s = await salon(t.db);
    await t.db.update(shops).set({ timezone: "America/Montreal" }).where(eq(shops.id, s.shop.id));
    // Julie works Thursday 09:00-12:00. The eight Thursdays before 2026-10-23 are 10-22 back to 09-03; she is off on two of them.
    await t.db.insert(schedules).values({ staffId: s.staff.julie.id, weekday: 4, startsAt: "09:00", endsAt: "12:00" });
    await t.db.insert(daysOff).values([{ staffId: s.staff.julie.id, onDate: "2026-10-15" }, { staffId: s.staff.julie.id, onDate: "2026-10-08" }]);
    const kept = await book(t.db, { shopId: s.shop.id, staffId: s.staff.julie.id, serviceId: s.services.cut.id, startsAt: new Date("2026-10-22T14:00:00Z") });
    const cancelled = await book(t.db, { shopId: s.shop.id, staffId: s.staff.julie.id, serviceId: s.services.cut.id, startsAt: new Date("2026-10-01T14:00:00Z") });
    await t.db.update(appointments).set({ status: "cancelled" }).where(eq(appointments.id, cancelled.id));
    expect(kept.id).toBeTruthy();

    const { input, slots } = await figuresSnapshot(t.db, s.shop.id, AT);
    expect(slots).toEqual([{ weekday: 4, startsAt: "09:00", offered: 6, booked: 1 }]);
    // 1 of 6 offered is booked: 17 %, under the default 25 % over at least 4 occurrences.
    const actions = nextActions({ figures: input, returnPrepared: false, slots }, DEFAULT_FIGURE_THRESHOLDS, ["slot"]);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ kind: "slot", why: { weekday: 4, startsAt: "09:00", booked: 1, offered: 6 } });
  });

  it("refuses a shop that does not exist", async () => {
    await expect(figuresSnapshot(t.db, "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b", AT)).rejects.toThrow(/AK_SHOP_UNKNOWN/);
  });
});
