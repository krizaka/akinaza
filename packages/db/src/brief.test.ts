import { shopBrief } from "@akinaza/core";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { briefActionsOf, briefMailShops, briefSnapshot, claimBriefAction, claimBriefDelivery, reachableClients, recordBriefResult, unsubscribeBrief } from "./brief";
import { appointments, daysOff, schedules, shops } from "./schema";
import { book, eraseClient, issueInvoice, recordConsent, recordExpense } from "./shop-ops";
import { freshDatabase } from "./test/db";
import { account, salon } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const AT = { week: "2026-W43", today: "2026-10-19", monday: "2026-10-19" };
const WINDOW = { lookBackWeeks: 8, aheadDays: 7 };

describe("the Monday brief's snapshot (real PostgreSQL 16)", () => {
  it("reads visits, free time, consents and last week's money in the shop's calendar", async () => {
    const s = await salon(t.db);
    await t.db.update(shops).set({ timezone: "America/Montreal" }).where(eq(shops.id, s.shop.id));
    // Julie works Thursday 9–17; Marc Thursday 9–13 but is off on 2026-10-22.
    await t.db.insert(schedules).values([
      { staffId: s.staff.julie.id, weekday: 4, startsAt: "09:00", endsAt: "17:00" },
      { staffId: s.staff.marc.id, weekday: 4, startsAt: "09:00", endsAt: "13:00" },
    ]);
    await t.db.insert(daysOff).values({ staffId: s.staff.marc.id, onDate: "2026-10-22" });
    // A done cut on 2026-09-03 for Camille; a done colour at 23:30 Montréal on 2026-10-18 (already 2026-10-19 in UTC): still in the window.
    const past = await book(t.db, { shopId: s.shop.id, staffId: s.staff.julie.id, serviceId: s.services.cut.id, clientId: s.client.id, startsAt: new Date("2026-09-03T14:00:00Z") });
    const late = await book(t.db, { shopId: s.shop.id, staffId: s.staff.marc.id, serviceId: s.services.colour.id, startsAt: new Date("2026-10-19T03:30:00Z") });
    await t.db.update(appointments).set({ status: "done" }).where(eq(appointments.id, past.id));
    await t.db.update(appointments).set({ status: "done" }).where(eq(appointments.id, late.id));
    // Thursday 2026-10-22: a 45-minute cut booked.
    await book(t.db, { shopId: s.shop.id, staffId: s.staff.julie.id, serviceId: s.services.cut.id, startsAt: new Date("2026-10-22T14:00:00Z") });
    await recordConsent(t.db, s.client.id, "marketing", true, "2026-10-01");
    // Last week (2026-10-12 → 18): one invoice and one half-business expense; this week's invoice is not counted.
    await issueInvoice(t.db, { shopId: s.shop.id, clientId: s.client.id, language: "fr", issuedOn: "2026-10-15", lines: [{ description: "Coupe", quantity: 1, unitPriceCents: 4500, category: "standard" }] });
    await issueInvoice(t.db, { shopId: s.shop.id, language: "fr", issuedOn: "2026-10-19", lines: [{ description: "Coupe", quantity: 1, unitPriceCents: 4500, category: "standard" }] });
    await recordExpense(t.db, { shopId: s.shop.id, supplier: "Fournitures Laval", paidOn: "2026-10-14", subtotalCents: 2000, gstCents: 100, qstCents: 200, businessSharePct: 50 });

    const snap = await briefSnapshot(t.db, s.shop.id, AT, WINDOW);
    expect(snap.done.map((v) => ({ day: v.day, minutes: v.minutes, clientId: v.clientId }))).toEqual([
      { day: "2026-09-03", minutes: 45, clientId: s.client.id },
      { day: "2026-10-18", minutes: 90, clientId: null },
    ]);
    expect(snap.ahead.find((d) => d.day === "2026-10-22")).toEqual({ day: "2026-10-22", openMinutes: 480, bookedMinutes: 45 });
    expect(snap.ahead.filter((d) => d.openMinutes > 0)).toHaveLength(1);
    expect(snap.clients).toEqual([{ id: s.client.id, contactable: true, marketing: true, erased: false }]);
    expect(snap.lastWeek.invoices.map((i) => [i.issuedOn, i.gstCents, i.qstCents])).toEqual([["2026-10-15", 225, 449]]);
    expect(snap.lastWeek.expenses.map((e) => [e.paidOn, e.businessSharePct])).toEqual([["2026-10-14", 50]]);
    // The core computes the taxes card from it: 225 + 449 − (50 + 100) = 524 ¢ to set aside.
    expect(shopBrief(snap).items.find((i) => i.kind === "taxes")?.figures.setAsideCents).toBe(524);
  });

  it("follows the latest consent: a withdrawn marketing consent and an erased client are never reachable", async () => {
    const s = await salon(t.db);
    const v = await book(t.db, { shopId: s.shop.id, staffId: s.staff.julie.id, serviceId: s.services.cut.id, clientId: s.client.id, startsAt: new Date("2026-09-10T14:00:00Z") });
    await t.db.update(appointments).set({ status: "done" }).where(eq(appointments.id, v.id));
    await recordConsent(t.db, s.client.id, "marketing", true, "2026-09-01");
    await recordConsent(t.db, s.client.id, "marketing", false, "2026-10-01");
    expect((await briefSnapshot(t.db, s.shop.id, AT, WINDOW)).clients).toEqual([{ id: s.client.id, contactable: true, marketing: false, erased: false }]);
    await recordConsent(t.db, s.client.id, "marketing", true, "2026-10-02");
    // Erasure also withdraws the consents: nothing left to write to.
    await eraseClient(t.db, s.client.id, "2026-10-02");
    expect((await briefSnapshot(t.db, s.shop.id, AT, WINDOW)).clients).toEqual([{ id: s.client.id, contactable: false, marketing: false, erased: true }]);
  });
});

describe("the brief's actions (real PostgreSQL 16, #200)", () => {
  it("claims an action once: a button pressed twice never sends twice, and the result is kept for the week", async () => {
    const s = await salon(t.db);
    const id = "2026-W43:gaps:ahead";
    expect(await claimBriefAction(t.db, s.shop.id, id, "invite")).toBe(true);
    expect(await claimBriefAction(t.db, s.shop.id, id, "invite")).toBe(false);
    await recordBriefResult(t.db, s.shop.id, id, { sent: 3, pending: 1, skipped: 2 });
    expect(await briefActionsOf(t.db, s.shop.id, "2026-W43")).toEqual({ [id]: { sent: 3, pending: 1, skipped: 2 } });
    expect(await briefActionsOf(t.db, s.shop.id, "2026-W44")).toEqual({});
  });

  it("refuses an id that is not a brief's", async () => {
    const s = await salon(t.db);
    await expect(claimBriefAction(t.db, s.shop.id, "anything; drop", "invite")).rejects.toThrow();
  });

  it("reads the invitees again at send time: consent withdrawn since the brief, another shop's client, an erased one are skipped", async () => {
    const s = await salon(t.db);
    const other = await salon(t.db);
    await recordConsent(t.db, s.client.id, "marketing", true, "2026-10-01");
    await recordConsent(t.db, other.client.id, "marketing", true, "2026-10-01");
    expect((await reachableClients(t.db, s.shop.id, [s.client.id, other.client.id])).map((c) => c.id)).toEqual([s.client.id]);
    await recordConsent(t.db, s.client.id, "marketing", false, "2026-10-20");
    expect(await reachableClients(t.db, s.shop.id, [s.client.id])).toEqual([]);
    await recordConsent(t.db, s.client.id, "marketing", true, "2026-10-21");
    expect(await reachableClients(t.db, s.shop.id, [s.client.id])).toEqual([{ id: s.client.id, fullName: "Camille Tremblay", email: "camille@example.test", language: "fr" }]);
    await eraseClient(t.db, s.client.id, "2026-10-22");
    expect(await reachableClients(t.db, s.shop.id, [s.client.id])).toEqual([]);
  });
});

describe("the brief by e-mail (real PostgreSQL 16, #200)", () => {
  it("lists the shops of an active owner, claims one mail per week, and turns it off from the mail's link", async () => {
    const s = await salon(t.db);
    const owner = await account(t.db, `owner-${s.shop.id.slice(0, 8)}@example.test`);
    await t.db.update(shops).set({ ownerId: owner.id }).where(eq(shops.id, s.shop.id));
    const mine = async () => (await briefMailShops(t.db)).find((x) => x.id === s.shop.id);
    expect(await mine()).toMatchObject({ ownerEmail: owner.email, ownerLocale: "fr", lastWeek: null });

    const token = await claimBriefDelivery(t.db, s.shop.id, "2026-W43", 3);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await claimBriefDelivery(t.db, s.shop.id, "2026-W43", 3)).toBeNull(); // the second tick, or another instance
    expect((await mine())?.lastWeek).toBe("2026-W43");
    const stored = await t.db.execute(sql`SELECT unsubscribe_sha256 FROM brief_deliveries WHERE shop_id = ${s.shop.id}`);
    expect(JSON.stringify(stored.rows)).not.toContain(token!); // only the hash is kept

    expect(await unsubscribeBrief(t.db, "not-a-token")).toBe(false);
    expect(await unsubscribeBrief(t.db, "A".repeat(43))).toBe(false);
    expect(await unsubscribeBrief(t.db, token!)).toBe(true);
    expect(await mine()).toBeUndefined();
  });
});
