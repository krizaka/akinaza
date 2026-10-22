import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { clients } from "./schema";

import { addDayOff, addStaff, addWindow, akCode, bookingDetail, bookVisit, joinShop, listSlots, publicShop, saveService, saveShopPage, ShopError } from "./service-shop";
import { freshDatabase } from "./test/db";
import { account, NOW } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof ShopError ? e.code : akCode(e);
  }
  return null;
};

/** A salon: Léa (owner) works Monday–Friday 09:00–12:00, Samuel Tuesday–Saturday 13:00–17:00; one 60-minute cut; two clients. */
async function salon(tag: string) {
  const owner = await account(t.db, `salon-${tag}@example.test`);
  const page = { name: "Salon Test", legalName: "Salon Test", address: "1 rue Test", slug: `salon-${tag}`, ownerName: "Léa", businessType: "professional" as const };
  const { shopId } = await saveShopPage(t.db, owner.id, { ...page, published: false });
  const cut = await saveService(t.db, shopId, { nameFr: "Coupe", nameEn: "Haircut", durationMinutes: 60, priceCents: 6_500, capacity: 1 });
  for (const weekday of [1, 2, 3, 4, 5]) await addWindow(t.db, shopId, { weekday, startsAt: "09:00", endsAt: "12:00" });
  const samuel = await addStaff(t.db, shopId, "Samuel");
  for (const weekday of [2, 3, 4, 5, 6]) await addWindow(t.db, shopId, { weekday, startsAt: "13:00", endsAt: "17:00" }, samuel);
  await saveShopPage(t.db, owner.id, { ...page, published: true });
  const client = async (n: string) => {
    const acc = await account(t.db, `c${n}-${tag}@example.test`);
    return (await joinShop(t.db, acc.id, acc.email, shopId, { fullName: `Client ${n}`, phone: "514-555-0100", language: "fr", consentService: true })).clientId;
  };
  const lea = (await publicShop(t.db, `salon-${tag}`))!.team.find((m) => m.name === "Léa")!.id;
  return { shopId, cut, samuel, lea, c1: await client("1"), c2: await client("2"), c3: await client("3") };
}

describe("several people work at the shop", () => {
  it("the public page lists who works there, and merges everyone's hours into the shop's", async () => {
    const s = await salon("team");
    const page = (await publicShop(t.db, "salon-team"))!;
    expect(page.team.map((m) => m.name).sort()).toEqual(["Léa", "Samuel"]);
    const tuesday = page.windows.filter((w) => w.weekday === 2).map((w) => [w.startsAt.slice(0, 5), w.endsAt.slice(0, 5)]);
    expect(tuesday).toEqual([["09:00", "12:00"], ["13:00", "17:00"]]);
    expect(s.lea).toBeTruthy();
  });

  it("one person's times are their own hours; anyone's are the union", async () => {
    const s = await salon("slots");
    const base = { shopId: s.shopId, serviceId: s.cut, zoneId: null, now: NOW, fromDay: "2026-10-20", days: 1 };
    const hoursOf = async (staffId?: string) => (await listSlots(t.db, { ...base, staffId })).map((x) => x.startsAt.toISOString().slice(11, 16));
    expect(await hoursOf(s.lea)).toEqual(["13:00", "13:30", "14:00", "14:30", "15:00"]); // 09:00–12:00 Montréal = 13:00–16:00 UTC, every 30 minutes
    expect((await hoursOf(s.samuel))[0]).toBe("17:00");
    const anyone = await listSlots(t.db, base);
    expect(anyone.length).toBe((await hoursOf(s.lea)).length + (await hoursOf(s.samuel)).length);
    expect(new Set(anyone.map((x) => x.staffId))).toEqual(new Set([s.lea, s.samuel]));
  });

  it("a day off is one person's, not the shop's", async () => {
    const s = await salon("off");
    await addDayOff(t.db, s.shopId, "2026-10-20", "Vacances", s.samuel);
    const base = { shopId: s.shopId, serviceId: s.cut, zoneId: null, now: NOW, fromDay: "2026-10-20", days: 1 };
    expect((await listSlots(t.db, { ...base, staffId: s.samuel })).length).toBe(0);
    expect((await listSlots(t.db, { ...base, staffId: s.lea })).length).toBeGreaterThan(0);
  });

  it("booking anyone takes a free person, and two bookings at the same time go to two people", async () => {
    const s = await salon("any");
    const tuesday = new Date("2026-10-20T17:00:00Z"); // 13:00 Montréal: Samuel starts; Léa is done at 12:00 → only Samuel
    const first = await bookVisit(t.db, { clientId: s.c1, serviceId: s.cut, zoneId: null, dependantIds: [], startsAt: tuesday, now: NOW });
    expect(first.appointmentId).toBeTruthy();
    // The same time again: nobody is left at 13:00.
    expect(await code(bookVisit(t.db, { clientId: s.c2, serviceId: s.cut, zoneId: null, dependantIds: [], startsAt: tuesday, now: NOW }))).toBe("AK_SLOT_UNAVAILABLE");
  });

  it("two people free at once: anyone fills one, then the other, then the time is gone", async () => {
    const owner = await account(t.db, "both@example.test");
    const page = { name: "Duo", legalName: "Duo", address: "1 rue Test", slug: "duo", ownerName: "Ana", businessType: "professional" as const };
    const { shopId } = await saveShopPage(t.db, owner.id, { ...page, published: false });
    const cut = await saveService(t.db, shopId, { nameFr: "Coupe", nameEn: "Cut", durationMinutes: 60, priceCents: 5_000, capacity: 1 });
    const bea = await addStaff(t.db, shopId, "Béa");
    for (const staffId of [undefined, bea]) await addWindow(t.db, shopId, { weekday: 2, startsAt: "09:00", endsAt: "12:00" }, staffId);
    await saveShopPage(t.db, owner.id, { ...page, published: true });
    const clientIds: string[] = [];
    for (const n of [1, 2, 3]) {
      const acc = await account(t.db, `duo${n}@example.test`);
      clientIds.push((await joinShop(t.db, acc.id, acc.email, shopId, { fullName: `D${n}`, phone: "514-555-0100", language: "fr", consentService: true })).clientId);
    }
    const nine = new Date("2026-10-20T13:00:00Z");
    const book = (clientId: string, staffId?: string) => bookVisit(t.db, { clientId, serviceId: cut, zoneId: null, dependantIds: [], startsAt: nine, now: NOW, staffId });
    await book(clientIds[0]!);
    await book(clientIds[1]!);
    expect(await code(book(clientIds[2]!))).toBe("AK_SLOT_UNAVAILABLE");
    const left = await listSlots(t.db, { shopId, serviceId: cut, zoneId: null, now: NOW, fromDay: "2026-10-20", days: 1 });
    expect(left.some((x) => x.startsAt.getTime() === nine.getTime())).toBe(false);
  });

  it("asking for a person books that person; a stranger's id is refused", async () => {
    const s = await salon("pick");
    const ten = new Date("2026-10-20T14:00:00Z");
    await bookVisit(t.db, { clientId: s.c1, serviceId: s.cut, zoneId: null, dependantIds: [], startsAt: ten, now: NOW, staffId: s.lea });
    const left = await listSlots(t.db, { shopId: s.shopId, serviceId: s.cut, zoneId: null, now: NOW, fromDay: "2026-10-20", days: 1, staffId: s.lea });
    expect(left.some((x) => x.startsAt.getTime() === ten.getTime())).toBe(false);
    expect(await code(bookVisit(t.db, { clientId: s.c2, serviceId: s.cut, zoneId: null, dependantIds: [], startsAt: ten, now: NOW, staffId: "00000000-0000-4000-8000-000000000000" }))).toBe("AK_STAFF_UNKNOWN");
    // Samuel is not free at 10:00 (he starts at 13:00): asking for him is refused as unavailable.
    expect(await code(bookVisit(t.db, { clientId: s.c3, serviceId: s.cut, zoneId: null, dependantIds: [], startsAt: ten, now: NOW, staffId: s.samuel }))).toBe("AK_SLOT_UNAVAILABLE");
  });
});

describe("a booking, as its confirmation page reads it", () => {
  it("is read by its owner only, with the person, the time and whether it can still be cancelled", async () => {
    const s = await salon("detail");
    const when = new Date("2026-10-27T17:00:00Z"); // Tuesday, 13:00 Montréal
    const { bookingIds } = await bookVisit(t.db, { clientId: s.c1, serviceId: s.cut, zoneId: null, dependantIds: [], startsAt: when, now: NOW });
    const owner = await accountOf(s.c1);
    const detail = (await bookingDetail(t.db, owner, bookingIds[0]!, NOW))!;
    expect(detail).toMatchObject({ cancelled: false, staffName: "Samuel", cancellable: true, cancellationHours: 24 });
    expect(detail.startsAt.toISOString()).toBe(when.toISOString());
    expect(detail.service.nameEn).toBe("Haircut");
    // Another account sees nothing; inside the window it cannot be cancelled any more.
    expect(await bookingDetail(t.db, await accountOf(s.c2), bookingIds[0]!, NOW)).toBeNull();
    expect((await bookingDetail(t.db, owner, bookingIds[0]!, new Date("2026-10-27T10:00:00Z")))!.cancellable).toBe(false);
  });
});

async function accountOf(clientId: string): Promise<string> {
  const [row] = await t.db.select({ id: clients.accountId }).from(clients).where(eq(clients.id, clientId));
  return row!.id!;
}
