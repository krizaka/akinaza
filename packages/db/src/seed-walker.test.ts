import { randomBytes } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prepareShopReturn } from "./shop-ops";
import { accounts } from "./schema";
import { localDay } from "@akinaza/core";
import { SAINT_HENRI, SAINT_HENRI_EMAILS, seedSaintHenri, seedTodayVisit } from "./seed-walker";
import { shopPageConfigOf } from "./shop-page";
import { listSlots, publicShop, revealAccessNotes, shopOfOwner } from "./service-shop";
import { freshDatabase } from "./test/db";
import { clientBookings, dayVisits, shopClients } from "./visits";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
  await t.db.insert(accounts).values(SAINT_HENRI_EMAILS.map((email) => ({ email, passwordHash: "x" })));
});
afterAll(async () => t.drop());

const NOW = new Date("2026-10-21T15:00:00Z"); // Wednesday 11:00 in Montréal

describe("the Saint-Henri walker persona", () => {
  it("builds a published shop, five clients with their dogs, a past walk with its report and an upcoming group walk", async () => {
    const key = randomBytes(32);
    const first = await seedSaintHenri(t.db, key, NOW);
    expect(first.created).toBe(true);
    const page = await publicShop(t.db, "pattes-saint-henri");
    expect(page?.zones.map((z) => z.name)).toEqual(["Saint-Henri", "Griffintown", "Pointe-Saint-Charles"]);
    expect(page?.services.map((s) => s.capacity).sort((a, b) => a - b)).toEqual([1, 1, 1, 5]);
    expect(page?.shop.bioEn).toMatch(/fictional/);
    expect(page?.shop.area).toBe("Saint-Henri, Montréal");
    expect(page?.zones.every((z) => z.lat !== null && z.lng !== null)).toBe(true);
    expect(page?.services.every((s) => s.includedFr.length > 0 && s.descriptionFr)).toBe(true);
    expect(page?.media.cover?.url).toMatch(/^https:\/\//);
    expect(page?.media.gallery.length).toBeGreaterThanOrEqual(3);
    // « Popular » from the walks really booked: the group walk (a past walk and two dogs on the next one).
    expect(page?.popularServiceId).toBe(page?.services.find((s) => s.capacity === 5)?.id);
    const clients = await shopClients(t.db, first.shopId);
    expect(clients).toHaveLength(5);
    expect(clients.flatMap((c) => c.dependants.map((d) => d.name)).sort((a, b) => a.localeCompare(b))).toEqual(["Biscuit", "Érable", "Luna", "Pixel", "Rex", "Tofu"]);
    expect(clients.filter((c) => c.hasNotes)).toHaveLength(3);
    const camille = first.clientIds[SAINT_HENRI.clients[0]!.email]!;
    expect(await revealAccessNotes(t.db, key, camille)).toContain("4821");
    const mine = await clientBookings(t.db, camille);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ visitStatus: "done", report: { durationMinutes: 52 } });
    // The group walk with two dogs: the third joins it.
    const owner = (await t.db.select().from(accounts).where(eq(accounts.email, SAINT_HENRI_EMAILS[0])))[0]!;
    const shop = (await shopOfOwner(t.db, owner.id))!;
    const group = page!.services.find((s) => s.capacity === 5)!;
    const joinable = (await listSlots(t.db, { shopId: shop.id, serviceId: group.id, zoneId: page!.zones[0]!.id, now: NOW })).find((s) => s.joins);
    expect(joinable).toMatchObject({ seatsLeft: 3, capacity: 5 });
    const day = await dayVisits(t.db, shop.id, joinable!.startsAt.toISOString().slice(0, 10));
    expect(day[0]!.bookings.map((b) => b.dependant.name).sort((a, b) => a.localeCompare(b))).toEqual(["Érable", "Luna"]);
  });

  it("wears the story template of her trade, applied once by the seed (#261, step 6)", async () => {
    const shop = (await shopOfOwner(t.db, (await t.db.select().from(accounts).where(eq(accounts.email, SAINT_HENRI_EMAILS[0])))[0]!.id))!;
    const config = await shopPageConfigOf(t.db, shop.id);
    expect(SAINT_HENRI.template).toBe("pets-histoire");
    expect(config).toMatchObject({ templateId: "pets-histoire", templateVersion: 1, sectionsCustom: false });
    expect(config.sections[0]!.id).toBe("trust"); // the story first
    await seedSaintHenri(t.db, randomBytes(32), NOW);
    expect((await shopPageConfigOf(t.db, shop.id)).templateId).toBe("pets-histoire");
  });

  it("is idempotent, and its clients and dogs never mix with another walker's", async () => {
    const again = await seedSaintHenri(t.db, randomBytes(32), NOW);
    expect(again.created).toBe(false);
    const count = await t.db.execute(sql`SELECT count(*)::int AS n FROM clients`);
    expect((count.rows[0] as { n: number }).n).toBe(5);
  });

  it("keeps the books of the demo walker: GST/QST registrant, three months of invoices, expenses with their credits, once", async () => {
    const owner = (await t.db.select().from(accounts).where(eq(accounts.email, SAINT_HENRI_EMAILS[0])))[0]!;
    const shop = (await shopOfOwner(t.db, owner.id))!;
    const ret = await prepareShopReturn(t.db, shop.id, "2026-07-01", "2026-09-30");
    const get = (line: string) => ret.lines.find((l) => l.line === line)!;
    expect(get("101").amountCents).toBeGreaterThan(0);
    expect(get("103").amountCents).toBeGreaterThan(0);
    expect(get("106").sources.length).toBeGreaterThan(0);
    expect(get("203").sources.every((s) => s.kind === "invoice")).toBe(true);
    expect(get("206").sources.every((s) => s.kind === "expense")).toBe(true);
    // The two taxes balance: collected - credits = net, to the cent.
    expect(get("109").amountCents).toBe(get("103").amountCents - get("106").amountCents);
    expect(get("209").amountCents).toBe(get("203").amountCents - get("206").amountCents);
    const n = await t.db.execute(sql`SELECT count(*)::int AS n FROM invoices`);
    await seedSaintHenri(t.db, randomBytes(32), NOW);
    expect(((await t.db.execute(sql`SELECT count(*)::int AS n FROM invoices`)).rows[0] as { n: number }).n).toBe((n.rows[0] as { n: number }).n);
  });

  it("books a test visit TODAY at the injected clock + 1 h, whatever the hour, once (#433)", async () => {
    const owner = (await t.db.select().from(accounts).where(eq(accounts.email, SAINT_HENRI_EMAILS[0])))[0]!;
    const shop = (await shopOfOwner(t.db, owner.id))!;
    // 11:00, 15:00 (Montréal) and 23:30 (the hour would cross midnight: the visit stays on the day).
    for (const [now, day] of [["2026-10-21T15:00:00Z", "2026-10-21"], ["2026-10-21T19:00:00Z", "2026-10-21"], ["2026-10-22T03:30:00Z", "2026-10-21"]] as const) {
      const first = await seedTodayVisit(t.db, new Date(now));
      expect(first.created).toBe(true);
      expect(localDay(first.startsAt, shop.timezone)).toBe(day);
      const again = await seedTodayVisit(t.db, new Date(now));
      expect(again).toMatchObject({ created: false, appointmentId: first.appointmentId });
      const listed = (await dayVisits(t.db, shop.id, day)).filter((v) => v.appointmentId === first.appointmentId);
      expect(listed).toHaveLength(1);
      expect(listed[0]).toMatchObject({ status: "booked", service: { en: "Puppy visit 20 min" } });
      expect(listed[0]!.bookings.map((b) => b.dependant.name)).toEqual(["Rex"]);
    }
    const first = await seedTodayVisit(t.db, new Date("2026-10-21T15:00:00Z"));
    expect(first.startsAt.toISOString()).toBe("2026-10-21T16:00:00.000Z");
  });
});
