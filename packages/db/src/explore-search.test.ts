import { exploreQuerySchema, type ExploreQuery } from "@akinaza/core";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { exploreSearch, settleAvailability } from "./explore";
import { appointments, busyIntervals, calendarConnections, daysOff, schedules, services, shopRules, shopZones, shops, staff } from "./schema";
import { addZone } from "./service-shop";
import { book } from "./shop-ops";
import { freshDatabase } from "./test/db";
import { NOW, studioShop, walkerShop } from "./test/fixtures";

// Monday 19 October 2026: 10:00 in Montréal (14:00Z); 16:00 (20:00Z) = the studio's last hour; Saturday 24 October is closed for both.
const MON_10 = new Date("2026-10-19T14:00:00Z");
const MON_16 = new Date("2026-10-19T20:00:00Z");
const MON_21 = new Date("2026-10-20T01:00:00Z");
const SAT = new Date("2026-10-24T14:00:00Z");

let t: Awaited<ReturnType<typeof freshDatabase>>;
let walker: Awaited<ReturnType<typeof walkerShop>>;
let studio: Awaited<ReturnType<typeof studioShop>>;
// The stored availability is read by the list; the sweep that fills it runs first, at the same clock (as the server's tick does).
const search = async (query: Partial<Record<keyof ExploreQuery, unknown>>, now = MON_10) => {
  await settleAvailability(t.db, now);
  return exploreSearch(t.db, exploreQuerySchema.parse(query), now);
};
const ask = async (query: Partial<Record<keyof ExploreQuery, unknown>>, now = MON_10) => (await search(query, now)).shops.map((s) => s.slug);
const stale = async (shopId: string) => (await t.db.execute(sql`SELECT avail_stale FROM shop_search WHERE shop_id = ${shopId}`)).rows[0]!.avail_stale as boolean;

beforeAll(async () => {
  t = await freshDatabase();
  walker = await walkerShop(t.db, "x");
  studio = await studioShop(t.db, "x");
  // Saint-Henri (the walker) and downtown (the studio, about 2.8 km away).
  await t.db.update(shopZones).set({ lat: 45.4797, lng: -73.5848 }).where(eq(shopZones.id, walker.zones.stHenri));
  const downtown = await addZone(t.db, studio.shopId, "Centre-ville");
  await t.db.update(shopZones).set({ lat: 45.5017, lng: -73.5673 }).where(eq(shopZones.id, downtown));
});
afterAll(async () => t.drop());

describe("Explorer's combined search (real PostgreSQL)", () => {
  it("lists every published shop by name with no filter", async () => {
    expect(await ask({})).toEqual(["pattes-x", "studio-x"]);
  });

  it("finds by words: accents, prefixes of a service name, and a typo of the name", async () => {
    expect(await ask({ q: "boreal" })).toEqual(["studio-x"]); // « Studio Boréal »
    expect(await ask({ q: "promen" })).toEqual(["pattes-x"]); // « Promenade solo 60 min »
    expect(await ask({ q: "saint henri" })).toEqual(["pattes-x"]);
    expect(await ask({ q: "pates" })).toEqual(["pattes-x"]); // trigram: one letter missing
    expect(await ask({ q: "zzzzzz" })).toEqual([]);
  });

  it("a hostile search is only words: it neither fails nor returns what it names", async () => {
    expect(await ask({ q: "'; DROP TABLE shops; --" })).toEqual([]);
    expect(await t.db.$count(shops)).toBe(2);
  });

  it("filters by kind (OR inside the group)", async () => {
    const [row] = await t.db.select({ kind: shops.kind }).from(shops).where(eq(shops.id, studio.shopId));
    const kind = row!.kind;
    expect(await ask({ kinds: [kind] })).toContain("studio-x");
    expect(await ask({ kinds: ["boutique"] })).toEqual(expect.not.arrayContaining(["studio-x"]));
  });

  it("open now follows the shop's hours in its own zone (10:00 both, 16:00 the studio only, 21:00 and Saturday none)", async () => {
    expect(await ask({ open: "now" }, MON_10)).toEqual(["pattes-x", "studio-x"]);
    expect(await ask({ open: "now" }, MON_16)).toEqual(["studio-x"]);
    expect(await ask({ open: "now" }, MON_21)).toEqual([]);
    expect(await ask({ open: "now" }, SAT)).toEqual([]);
  });

  it("open this week looks at the next 7 local days (today whole), by day", async () => {
    expect(await ask({ open: "week" }, SAT)).toEqual(["pattes-x", "studio-x"]); // Monday is two days away
    expect(await ask({ open: "week" }, MON_16)).toEqual(["pattes-x", "studio-x"]); // the walker opens again tomorrow
  });

  it("a day off closes the shop that day only (now and today), the week stays open", async () => {
    const [member] = await t.db.select().from(staff).where(eq(staff.shopId, studio.shopId));
    await t.db.insert(daysOff).values({ staffId: member!.id, onDate: "2026-10-19", reason: "test" });
    expect(await ask({ open: "now" }, MON_16)).toEqual([]);
    expect(await ask({ open: "week" }, MON_16)).toEqual(["pattes-x", "studio-x"]);
    await t.db.delete(daysOff).where(eq(daysOff.staffId, member!.id));
  });

  it("a shop in another time zone is open by its own clock (Vancouver: 07:00 at 14:00Z), and the read model follows the change", async () => {
    await t.db.update(shops).set({ timezone: "America/Vancouver" }).where(eq(shops.id, studio.shopId));
    expect(await ask({ open: "now" }, MON_10)).toEqual(["pattes-x"]);
    expect(await ask({ open: "now" }, new Date("2026-10-19T17:00:00Z"))).toEqual(["studio-x"]); // 10:00 in Vancouver, 13:00 in Montréal (the walker is closed)
    await t.db.update(shops).set({ timezone: "America/Toronto" }).where(eq(shops.id, studio.shopId));
  });

  it("filters by distance from a position, nearest first, and reports the distance", async () => {
    const near: [number, number] = [-73.5848, 45.4797]; // at the walker
    const all = (await exploreSearch(t.db, exploreQuerySchema.parse({ near }), NOW)).shops;
    expect(all.map((s) => s.slug)).toEqual(["pattes-x", "studio-x"]);
    expect(all[0]!.distanceMeters).toBe(0);
    expect(all[1]!.distanceMeters).toBeGreaterThan(2_500);
    expect(all[1]!.distanceMeters).toBeLessThan(3_500);
    expect(await ask({ near, within: 1 })).toEqual(["pattes-x"]);
    expect(await ask({ near, within: 3 })).toEqual(["pattes-x", "studio-x"]);
    expect(await ask({ near, within: 10 })).toEqual(["pattes-x", "studio-x"]);
    expect(await ask({ near: [-73.5673, 45.5017], within: 1 })).toEqual(["studio-x"]);
  });

  it("filters by the map's box", async () => {
    expect(await ask({ bbox: [-73.6, 45.47, -73.58, 45.49] })).toEqual(["pattes-x"]);
    expect(await ask({ bbox: [-73.6, 45.4, -73.5, 45.6] })).toEqual(["pattes-x", "studio-x"]);
    expect(await ask({ bbox: [-70, 40, -69, 41] })).toEqual([]);
  });

  it("combines the groups with AND: words, opening and distance together", async () => {
    const near: [number, number] = [-73.5848, 45.4797];
    expect(await ask({ q: "studio", open: "now", near, within: 10 }, MON_16)).toEqual(["studio-x"]);
    expect(await ask({ q: "studio", open: "now", near, within: 1 }, MON_16)).toEqual([]); // too far
    expect(await ask({ q: "pattes", open: "now" }, MON_16)).toEqual([]); // closed at 16:00
  });

  it("pages in a stable order and says where the next page starts", async () => {
    const first = await exploreSearch(t.db, exploreQuerySchema.parse({ limit: 1 }), NOW);
    expect(first.shops.map((s) => s.slug)).toEqual(["pattes-x"]);
    expect(first.next).toBe(1);
    const second = await exploreSearch(t.db, exploreQuerySchema.parse({ limit: 1, offset: first.next! }), NOW);
    expect(second.shops.map((s) => s.slug)).toEqual(["studio-x"]);
    expect(second.next).toBeNull();
  });

  it("keeps a free-today search to the shops that really have a free time", async () => {
    const free = await search({ open: "free-today" }, MON_10);
    expect(free.shops.length).toBeGreaterThan(0);
    expect(free.shops.every((s) => s.freeToday)).toBe(true);
    expect((await search({ open: "free-today" }, SAT)).shops).toEqual([]);
  });

  it("the read model follows every writer: a rename, a new service, an unpublish and a deleted area", async () => {
    await t.db.update(shops).set({ name: "Chiens du Sud-Ouest" }).where(eq(shops.id, walker.shopId));
    expect(await ask({ q: "sud-ouest" })).toEqual(["pattes-x"]);
    expect(await ask({ q: "pattes" })).toEqual([]);
    await t.db.update(services).set({ nameEn: "Hamster spa", nameFr: "Spa pour hamster" }).where(eq(services.id, walker.solo));
    expect(await ask({ q: "hamster" })).toEqual(["pattes-x"]);
    await t.db.update(shopZones).set({ active: false }).where(eq(shopZones.id, walker.zones.stHenri));
    expect(await ask({ near: [-73.5848, 45.4797], within: 1 })).toEqual([]); // its other areas have no position
    await t.db.update(shops).set({ published: false }).where(eq(shops.id, walker.shopId));
    expect(await ask({})).toEqual(["studio-x"]);
    expect(await t.db.execute(sql`SELECT 1 FROM shop_search WHERE shop_id = ${walker.shopId}`).then((r) => r.rows.length)).toBe(0);
  });

  it("carries nothing private (no street address, owner, legal name or tax number)", async () => {
    const json = JSON.stringify(await exploreSearch(t.db, exploreQuerySchema.parse({}), NOW));
    expect(json).not.toMatch(/Notre-Dame|rue Exemple|legalName|ownerId|gstNumber|qstNumber|address/);
  });

  it("stores each shop's next free time and answers the list from it, without the slot engine (free today, the time, the shop's own day)", async () => {
    const page = await search({ q: "studio" }, MON_10);
    expect(page.shops[0]!.freeToday).toBe(true);
    expect(new Date(page.shops[0]!.nextFreeAt!).getTime()).toBeGreaterThanOrEqual(MON_10.getTime());
    expect(new Date(page.shops[0]!.nextFreeAt!).getTime()).toBeLessThan(MON_21.getTime());
    // Saturday: closed, the next time is Monday: stored, not « free today ».
    const sat = (await search({ q: "studio" }, SAT)).shops[0]!;
    expect(sat.freeToday).toBe(false);
    expect(sat.nextFreeAt).toMatch(/^2026-10-26T/);
  });

  it("a changed answer waits for the sweep (the stale window), then follows: a day off, the services, the day change and the passing time", async () => {
    const [member] = await t.db.select().from(staff).where(eq(staff.shopId, studio.shopId));
    expect((await search({ q: "studio" }, MON_10)).shops[0]!.freeToday).toBe(true);
    expect(await stale(studio.shopId)).toBe(false);
    await t.db.insert(daysOff).values({ staffId: member!.id, onDate: "2026-10-19", reason: "test" });
    expect(await stale(studio.shopId)).toBe(true);
    // Before the sweep the list still says what was stored; the sweep settles it.
    expect((await exploreSearch(t.db, exploreQuerySchema.parse({ q: "studio" }), MON_10)).shops[0]!.freeToday).toBe(true);
    expect(await settleAvailability(t.db, MON_10)).toBeGreaterThanOrEqual(1);
    expect(await stale(studio.shopId)).toBe(false);
    const off = (await search({ q: "studio" }, MON_10)).shops[0]!;
    expect(off.freeToday).toBe(false);
    expect(off.nextFreeAt).toMatch(/^2026-10-20T/); // tomorrow
    await t.db.delete(daysOff).where(eq(daysOff.staffId, member!.id));
    // The day changes with no event at all: Tuesday's sweep moves the stored time to Tuesday.
    const tuesday = new Date("2026-10-20T14:00:00Z");
    const next = (await search({ q: "studio" }, tuesday)).shops[0]!;
    expect(next.freeToday).toBe(true);
    expect(next.nextFreeAt!.slice(0, 10)).toBe("2026-10-20");
    // The stored time passes (after the last window): due again, no longer free today.
    const evening = new Date("2026-10-20T22:00:00Z");
    expect((await search({ q: "studio" }, evening)).shops[0]!.freeToday).toBe(false);
    // The studio sells nothing any more.
    await t.db.update(services).set({ active: false }).where(eq(services.shopId, studio.shopId));
    expect((await search({ q: "studio" }, tuesday)).shops[0]!.nextFreeAt).toBeNull();
    await t.db.update(services).set({ active: true }).where(eq(services.shopId, studio.shopId));
  });

  it("every writer that moves the answer raises the flag: a booking and its cancellation, hours, a day off, a rule, a person, a service and a calendar", async () => {
    const [member] = await t.db.select().from(staff).where(eq(staff.shopId, studio.shopId));
    const [service] = await t.db.select().from(services).where(eq(services.shopId, studio.shopId));
    const settled = async () => { await settleAvailability(t.db, MON_10); expect(await stale(studio.shopId)).toBe(false); };
    const raises = async (label: string, change: () => Promise<unknown>) => {
      await settled();
      await change();
      expect(await stale(studio.shopId), label).toBe(true);
    };
    let appointmentId = "";
    await raises("a booking", async () => { appointmentId = (await book(t.db, { shopId: studio.shopId, staffId: member!.id, serviceId: service!.id, startsAt: new Date("2026-10-21T15:00:00Z") })).id; });
    await raises("a cancellation", () => t.db.update(appointments).set({ status: "cancelled" }).where(eq(appointments.id, appointmentId)));
    await raises("hours", () => t.db.insert(schedules).values({ staffId: member!.id, weekday: 6, startsAt: "10:00", endsAt: "12:00" }));
    await raises("a day off", () => t.db.insert(daysOff).values({ staffId: member!.id, onDate: "2026-11-02", reason: "test" }));
    await raises("a rule", () => t.db.update(shopRules).set({ minNoticeMinutes: 90 }).where(eq(shopRules.shopId, studio.shopId)));
    await raises("a service", () => t.db.update(services).set({ durationMinutes: 45 }).where(eq(services.id, service!.id)));
    await raises("a person", () => t.db.update(staff).set({ active: true }).where(eq(staff.id, member!.id)));
    const [connection] = await t.db.insert(calendarConnections).values({ shopId: studio.shopId, kind: "ics", label: "Agenda", secretEnc: "x", consentTextVersion: "v1", consentedAt: MON_10 }).returning();
    await raises("a calendar's busy time", () => t.db.insert(busyIntervals).values({ connectionId: connection!.id, shopId: studio.shopId, staffId: null, during: "[2026-10-22T14:00:00Z,2026-10-22T15:00:00Z)" }));
    await t.db.delete(schedules).where(eq(schedules.weekday, 6));
    await t.db.delete(daysOff).where(eq(daysOff.staffId, member!.id));
    await t.db.update(shopRules).set({ minNoticeMinutes: 120 }).where(eq(shopRules.shopId, studio.shopId));
  });

  it("two sweeps at once never settle the same shop twice (leased), and a change made while computing is not lost", async () => {
    await t.db.execute(sql`UPDATE shop_search SET avail_stale = true`);
    const [a, b] = await Promise.all([settleAvailability(t.db, MON_10), settleAvailability(t.db, MON_10)]);
    expect(a + b).toBe(1); // one published shop left: it is settled once, by one of the two
    expect(await settleAvailability(t.db, MON_10)).toBe(0);
  });
});
