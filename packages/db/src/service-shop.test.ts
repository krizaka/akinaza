import { randomBytes } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appointments, bookings, clients } from "./schema";
import { addDayOff, addDependant, addWindow, akCode, bookVisit, cancelBooking, joinShop, listSlots, publicShop, revealAccessNotes, saveShopPage, setAccessNotes, ShopError } from "./service-shop";
import { freshDatabase, refusal } from "./test/db";
import { account, NOW, walkerShop } from "./test/fixtures";

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
const tuesday9 = new Date("2026-10-20T13:00:00Z");

describe("the shop page", () => {
  it("is public only once published, by its address", async () => {
    const owner = await account(t.db, "draft@example.test");
    const input = { name: "Brouillon", legalName: "Brouillon", address: "1 rue Test", slug: "brouillon", ownerName: "Léa" };
    const { shopId } = await saveShopPage(t.db, owner.id, input);
    expect(await publicShop(t.db, "brouillon")).toBeNull();
    expect(await code(saveShopPage(t.db, owner.id, { ...input, published: true }))).toBe("AK_NOT_PUBLISHABLE");
    expect(shopId).toBeTruthy();
  });

  it("refuses an address another shop holds, and a reserved or malformed one", async () => {
    const w = await walkerShop(t.db, "slug");
    const other = await account(t.db, "other-slug@example.test");
    const input = { name: "X", legalName: "X", address: "1 rue Test", ownerName: "Léa" };
    expect(await code(saveShopPage(t.db, other.id, { ...input, slug: "pattes-slug" }))).toBe("AK_SLUG_TAKEN");
    await expect(saveShopPage(t.db, other.id, { ...input, slug: "api" })).rejects.toThrow();
    const page = await publicShop(t.db, "pattes-slug");
    expect(page?.shop.id).toBe(w.shopId);
    expect(page?.zones.map((z) => z.name)).toEqual(["Saint-Henri", "Griffintown"]);
    expect(page?.services.map((s) => s.capacity).sort()).toEqual([1, 3]);
    expect(page?.rules.cancellationHours).toBe(24); // the version 1 defaults come from the migration
  });

  it("shows the public only what a visitor needs — no owner, no legal name, no address, no tax numbers, no staff id", async () => {
    const w = await walkerShop(t.db, "pub");
    await t.db.execute(sql`UPDATE shops SET gst_number = '123456789RT0001', qst_number = '1234567890TQ0001', address = '12 rue Secrète, Montréal' WHERE id = ${w.shopId}`);
    const page = await publicShop(t.db, "pattes-pub");
    expect(page).not.toBeNull();
    const wire = JSON.stringify(page);
    for (const secret of ["12 rue Secrète", "123456789RT0001", "1234567890TQ0001", "ownerId", "legalName", "address", "gstNumber", "qstNumber", "invoicePrefix", "staffId"]) {
      expect(wire, secret).not.toContain(secret);
    }
    expect(Object.keys(page!.shop).sort()).toEqual(["area", "bioEn", "bioFr", "id", "name", "ownerName", "publicEmail", "publicPhone", "seatUnitEn", "seatUnitFr", "slug", "taglineEn", "taglineFr", "timezone"]);
  });

  it("keeps a worker's weekly windows apart and refuses an end before a start", async () => {
    const w = await walkerShop(t.db, "win");
    expect(await code(addWindow(t.db, w.shopId, { weekday: 1, startsAt: "11:00", endsAt: "13:00" }))).toBe("AK_WINDOW_OVERLAP");
    expect(await code(addWindow(t.db, w.shopId, { weekday: 1, startsAt: "13:00", endsAt: "12:30" }))).toBe("AK_WINDOW_ORDER");
    await addWindow(t.db, w.shopId, { weekday: 1, startsAt: "13:00", endsAt: "15:00" });
  });
});

describe("slots and booking", () => {
  it("offers the hours, hides a day off, and takes a slot once a client books it", async () => {
    const w = await walkerShop(t.db, "slots");
    const q = { shopId: w.shopId, serviceId: w.solo, zoneId: w.zones.stHenri, now: NOW };
    const before = await listSlots(t.db, q);
    expect(before[0]!.startsAt.toISOString()).toBe("2026-10-19T14:00:00.000Z"); // Monday 10:00 local: now is 08:00 and the default notice is 120 minutes
    await addDayOff(t.db, w.shopId, "2026-10-20", "Vet");
    expect((await listSlots(t.db, q)).some((s) => s.startsAt.toISOString().startsWith("2026-10-20"))).toBe(false);
    const booked = await bookVisit(t.db, { clientId: w.camille.clientId, serviceId: w.solo, zoneId: w.zones.stHenri, dependantIds: [w.camille.dogId], startsAt: before[0]!.startsAt, now: NOW });
    expect(booked.bookingIds).toHaveLength(1);
    const after = await listSlots(t.db, q);
    expect(after.map((s) => s.startsAt.toISOString())).not.toContain("2026-10-19T14:00:00.000Z");
    expect(after.map((s) => s.startsAt.toISOString())).not.toContain("2026-10-19T14:30:00.000Z"); // overlaps the 60-minute walk
    expect(after.map((s) => s.startsAt.toISOString())).toContain("2026-10-19T15:00:00.000Z");
  });

  it("refuses a booking at a time the shop does not offer, without a zone, or for someone else's dog", async () => {
    const w = await walkerShop(t.db, "refuse");
    const base = { clientId: w.camille.clientId, serviceId: w.solo, zoneId: w.zones.stHenri, dependantIds: [w.camille.dogId], now: NOW };
    expect(await code(bookVisit(t.db, { ...base, startsAt: new Date("2026-10-19T03:00:00Z") }))).toBe("AK_SLOT_UNAVAILABLE");
    expect(await code(bookVisit(t.db, { ...base, zoneId: null, startsAt: tuesday9 }))).toBe("AK_ZONE_REQUIRED");
    expect(await code(bookVisit(t.db, { ...base, dependantIds: [w.jordan.dogId], startsAt: tuesday9 }))).toBe("AK_BOOKING_OWNERSHIP");
    expect(await code(bookVisit(t.db, { ...base, dependantIds: [], startsAt: tuesday9 }))).toBe("AK_DEPENDANTS_REQUIRED");
  });

  it("puts several dogs on one group walk, up to the capacity, and the database holds the line", async () => {
    const w = await walkerShop(t.db, "group");
    const third = await account(t.db, "third-group@example.test");
    const { clientId } = await joinShop(t.db, third.id, third.email, w.shopId, { fullName: "Nadia Benali", phone: "514-555-0142", language: "fr", consentService: true });
    const d1 = await addDependant(t.db, clientId, { kind: "dog", name: "Biscuit" });
    const d2 = await addDependant(t.db, clientId, { kind: "dog", name: "Pixel" });
    const book = (clientId: string, dependantIds: string[]) => bookVisit(t.db, { clientId, serviceId: w.group, zoneId: w.zones.stHenri, dependantIds, startsAt: tuesday9, now: NOW });
    const first = await book(w.camille.clientId, [w.camille.dogId]);
    const second = await book(w.jordan.clientId, [w.jordan.dogId]);
    expect(second.joined).toBe(true);
    expect(second.appointmentId).toBe(first.appointmentId); // one walk, one walker
    const slot = (await listSlots(t.db, { shopId: w.shopId, serviceId: w.group, zoneId: w.zones.stHenri, now: NOW })).find((s) => s.startsAt.getTime() === tuesday9.getTime());
    expect(slot).toMatchObject({ seatsLeft: 1, joins: true });
    expect(await code(book(clientId, [d1, d2]))).toBe("AK_CAPACITY_FULL");
    await book(clientId, [d1]);
    expect(await code(book(clientId, [d2]))).toBe("AK_SLOT_UNAVAILABLE"); // full: no longer offered
    // Even a write that goes around the application cannot seat a fourth dog.
    const raw = await refusal(t.db.insert(bookings).values({ appointmentId: first.appointmentId, clientId, dependantId: d2 }));
    expect(raw).toMatch(/AK_CAPACITY_FULL/);
    // A group in another zone is another walk: it is not joined.
    const other = await bookVisit(t.db, { clientId: w.camille.clientId, serviceId: w.group, zoneId: w.zones.griffintown, dependantIds: [w.camille.dogId], startsAt: new Date("2026-10-21T13:00:00Z"), now: NOW });
    expect(other.joined).toBe(false);
  });

  it("refuses, with a stable code and not a server error, a dog that already has a seat on that walk", async () => {
    const w = await walkerShop(t.db, "twice");
    const book = () => bookVisit(t.db, { clientId: w.camille.clientId, serviceId: w.group, zoneId: w.zones.stHenri, dependantIds: [w.camille.dogId], startsAt: tuesday9, now: NOW });
    await book();
    expect(await code(book())).toBe("AK_ALREADY_BOOKED");
  });

  it("serialises two clients racing for the same solo slot: one wins, the other is refused", async () => {
    const w = await walkerShop(t.db, "race");
    const go = (clientId: string, dogId: string) => bookVisit(t.db, { clientId, serviceId: w.solo, zoneId: w.zones.stHenri, dependantIds: [dogId], startsAt: tuesday9, now: NOW });
    const results = await Promise.allSettled([go(w.camille.clientId, w.camille.dogId), go(w.jordan.clientId, w.jordan.dogId)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect((rejected.reason as ShopError).code).toBe("AK_SLOT_UNAVAILABLE");
    expect(await t.db.select().from(appointments).where(eq(appointments.shopId, w.shopId))).toHaveLength(1);
  });

  it("cancels until the shop's window, frees the slot with the last seat, and keeps the rule per shop", async () => {
    const w = await walkerShop(t.db, "cancel");
    const near = await bookVisit(t.db, { clientId: w.camille.clientId, serviceId: w.solo, zoneId: w.zones.stHenri, dependantIds: [w.camille.dogId], startsAt: new Date("2026-10-19T14:00:00Z"), now: NOW });
    expect(await code(cancelBooking(t.db, w.camille.clientId, near.bookingIds[0]!, NOW))).toBe("AK_CANCEL_TOO_LATE"); // 2 h away, the rule is 24 h
    const far = await bookVisit(t.db, { clientId: w.camille.clientId, serviceId: w.solo, zoneId: w.zones.stHenri, dependantIds: [w.camille.dogId], startsAt: new Date("2026-10-22T13:00:00Z"), now: NOW });
    expect(await code(cancelBooking(t.db, w.jordan.clientId, far.bookingIds[0]!, NOW))).toBe("AK_BOOKING_UNKNOWN"); // not yours
    await cancelBooking(t.db, w.camille.clientId, far.bookingIds[0]!, NOW);
    const [visit] = await t.db.select().from(appointments).where(eq(appointments.id, far.appointmentId));
    expect(visit!.status).toBe("cancelled");
    await t.db.execute(sql`UPDATE shop_rules SET cancellation_hours = 1 WHERE shop_id = ${w.shopId}`);
    await cancelBooking(t.db, w.camille.clientId, near.bookingIds[0]!, NOW);
  });

  it("applies the booking horizon and the minimum notice of the shop's rules", async () => {
    const w = await walkerShop(t.db, "rules");
    await t.db.execute(sql`UPDATE shop_rules SET booking_horizon_days = 3, min_notice_minutes = 600 WHERE shop_id = ${w.shopId}`);
    const slots = await listSlots(t.db, { shopId: w.shopId, serviceId: w.solo, zoneId: w.zones.stHenri, now: NOW });
    const days = new Set(slots.map((s) => s.startsAt.toISOString().slice(0, 10)));
    expect([...days].sort()).toEqual(["2026-10-20", "2026-10-21"]); // Monday is inside the notice, Thursday beyond the 3-day horizon
    await expect(t.db.execute(sql`UPDATE shop_rules SET slot_step_minutes = 1 WHERE shop_id = ${w.shopId}`)).rejects.toThrow();
  });
});

describe("access notes (keys, door codes) are encrypted at rest", () => {
  it("stores ciphertext, opens it with the key and the row, and nothing else", async () => {
    const w = await walkerShop(t.db, "notes");
    const key = randomBytes(32);
    await setAccessNotes(t.db, key, w.camille.clientId, "Code 4821, clé sous le pot de lavande");
    const [row] = await t.db.select().from(clients).where(eq(clients.id, w.camille.clientId));
    expect(row!.accessNotesEnc).toMatch(/^v1\./);
    expect(JSON.stringify(row)).not.toContain("4821");
    const rawDump = await t.db.execute(sql`SELECT access_notes_enc FROM clients WHERE access_notes_enc LIKE '%4821%'`);
    expect(rawDump.rows).toHaveLength(0);
    expect(await revealAccessNotes(t.db, key, w.camille.clientId)).toBe("Code 4821, clé sous le pot de lavande");
    await expect(revealAccessNotes(t.db, randomBytes(32), w.camille.clientId)).rejects.toThrow();
    // A sealed value copied onto another client's row does not open (the row id is authenticated).
    await t.db.update(clients).set({ accessNotesEnc: row!.accessNotesEnc }).where(eq(clients.id, w.jordan.clientId));
    await expect(revealAccessNotes(t.db, key, w.jordan.clientId)).rejects.toThrow();
    // The database refuses plain text in that column.
    expect(await refusal(t.db.update(clients).set({ accessNotesEnc: "Code 4821" }).where(eq(clients.id, w.jordan.clientId)))).toMatch(/clients_access_notes_sealed/);
    await setAccessNotes(t.db, key, w.camille.clientId, null);
    expect(await revealAccessNotes(t.db, key, w.camille.clientId)).toBeNull();
  });
});
