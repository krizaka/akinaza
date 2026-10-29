import { exploreQuerySchema, type ExploreQuery } from "@akinaza/core";
import { addSeconds } from "date-fns";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { exploreSearch, forgetFreeToday } from "./explore";
import { daysOff, services, shopZones, shops, staff } from "./schema";
import { addZone } from "./service-shop";
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
const ask = async (query: Partial<Record<keyof ExploreQuery, unknown>>, now = MON_10) => (await exploreSearch(t.db, exploreQuerySchema.parse(query), now)).shops.map((s) => s.slug);

beforeAll(async () => {
  t = await freshDatabase();
  walker = await walkerShop(t.db, "x");
  studio = await studioShop(t.db, "x");
  // Saint-Henri (the walker) and downtown (the studio, about 2.8 km away).
  await t.db.update(shopZones).set({ lat: 45.4797, lng: -73.5848 }).where(eq(shopZones.id, walker.zones.stHenri));
  forgetFreeToday();
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

  it("open this week looks at the next 7 local days, and today counts only until its window ends", async () => {
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
    const free = await exploreSearch(t.db, exploreQuerySchema.parse({ open: "free-today" }), MON_10);
    expect(free.shops.length).toBeGreaterThan(0);
    expect(free.shops.every((s) => s.freeToday)).toBe(true);
    expect((await exploreSearch(t.db, exploreQuerySchema.parse({ open: "free-today" }), SAT)).shops).toEqual([]);
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

  it("keeps a shop's free-today answer for a minute of the given clock, then asks the slot engine again", async () => {
    forgetFreeToday();
    const free = async (now: Date) => (await exploreSearch(t.db, exploreQuerySchema.parse({ q: "studio" }), now)).shops[0]!.freeToday;
    expect(await free(MON_10)).toBe(true);
    await t.db.update(services).set({ active: false }).where(eq(services.shopId, studio.shopId)); // the studio sells nothing any more
    expect(await free(addSeconds(MON_10, 30))).toBe(true); // within the minute: remembered
    expect(await free(addSeconds(MON_10, 61))).toBe(false); // after: asked again
  });
});
