import { randomBytes } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "./schema";
import { SAINT_HENRI, SAINT_HENRI_EMAILS, seedSaintHenri } from "./seed-walker";
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
    expect(page?.shop.taglineEn).toMatch(/fictional/);
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

  it("is idempotent, and its clients and dogs never mix with another walker's", async () => {
    const again = await seedSaintHenri(t.db, randomBytes(32), NOW);
    expect(again.created).toBe(false);
    const count = await t.db.execute(sql`SELECT count(*)::int AS n FROM clients`);
    expect((count.rows[0] as { n: number }).n).toBe(5);
  });
});
