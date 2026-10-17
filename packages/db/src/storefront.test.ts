import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { addDayOff, addZone, bookVisit, listSlots, publicShop, saveService, saveShopMedia, saveShopPage } from "./service-shop";
import { freshDatabase, refusal } from "./test/db";
import { NOW, walkerShop } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const base = { legalName: "Pattes", address: "1 rue Test", ownerName: "Mathilde", published: true } as const;

describe("the storefront's data on the public page", () => {
  it("carries the locality, the bio, the contact and the owner's name — and still nothing private", async () => {
    const w = await walkerShop(t.db, "sf1");
    await saveShopPage(t.db, w.owner.id, { ...base, name: "Pattes", slug: "pattes-sf1", area: "Saint-Henri, Montréal", bioFr: "Je promène depuis 2019.", bioEn: "Walking since 2019.", publicPhone: "514-555-0100", publicEmail: "bonjour@pattes.test", seatUnitFr: "chiens", seatUnitEn: "dogs" });
    const page = await publicShop(t.db, "pattes-sf1");
    expect(page!.shop).toMatchObject({ area: "Saint-Henri, Montréal", bioEn: "Walking since 2019.", publicPhone: "514-555-0100", seatUnitEn: "dogs", ownerName: "Mathilde" });
    expect(JSON.stringify(page)).not.toContain("1 rue Test");
  });

  it("leaves the storefront's words as they are when a later save does not send them", async () => {
    const w = await walkerShop(t.db, "sf2");
    await saveShopPage(t.db, w.owner.id, { ...base, name: "Pattes", slug: "pattes-sf2", area: "Griffintown", bioEn: "Hello" });
    await saveShopPage(t.db, w.owner.id, { ...base, name: "Pattes 2", slug: "pattes-sf2" });
    expect((await publicShop(t.db, "pattes-sf2"))!.shop).toMatchObject({ name: "Pattes 2", area: "Griffintown", bioEn: "Hello" });
  });

  it("gives a service its sentence, its inclusions and « from », and keeps them through an edit that omits them", async () => {
    const w = await walkerShop(t.db, "sf3");
    await saveService(t.db, w.shopId, { id: w.solo, nameFr: "Promenade solo", nameEn: "Solo walk", durationMinutes: 60, priceCents: 3_000, capacity: 1, descriptionEn: "One dog, one walker.", includedEn: ["Fresh water", "A photo after"], priceVaries: true });
    await saveService(t.db, w.shopId, { id: w.solo, nameFr: "Promenade solo", nameEn: "Solo walk", durationMinutes: 60, priceCents: 3_200, capacity: 1 });
    const solo = (await publicShop(t.db, "pattes-sf3"))!.services.find((s) => s.id === w.solo)!;
    expect(solo).toMatchObject({ priceCents: 3_200, descriptionEn: "One dog, one walker.", includedEn: ["Fresh water", "A photo after"], priceVaries: true });
    expect(solo.includedFr).toEqual([]);
  });

  it("places a zone on the map, both coordinates or none", async () => {
    const w = await walkerShop(t.db, "sf4");
    await addZone(t.db, w.shopId, "Verdun", { lat: 45.459, lng: -73.572 });
    const page = await publicShop(t.db, "pattes-sf4");
    expect(page!.zones.find((z) => z.name === "Verdun")).toMatchObject({ lat: 45.459, lng: -73.572 });
    expect(page!.zones.find((z) => z.name === "Saint-Henri")).toMatchObject({ lat: null, lng: null });
    await expect(addZone(t.db, w.shopId, "Nowhere", { lat: 95, lng: 0 })).rejects.toThrow();
    expect(await refusal(t.pool.query(`UPDATE shop_zones SET lat = NULL WHERE name = 'Verdun'`))).toMatch(/shop_zones_position/);
  });

  it("lists the days off as dates, never their reasons", async () => {
    const w = await walkerShop(t.db, "sf5");
    await addDayOff(t.db, w.shopId, "2026-12-24", "Réveillon chez ma mère");
    const page = await publicShop(t.db, "pattes-sf5");
    expect(page!.daysOff).toEqual(["2026-12-24"]);
    expect(JSON.stringify(page)).not.toContain("Réveillon");
  });
});

describe("the shop's photos and loops", () => {
  const cover = { url: "https://cdn.test/cover.jpg", webmUrl: "https://cdn.test/cover.webm", mp4Url: "https://cdn.test/cover.mp4", altFr: "Un chien", altEn: "A dog" };
  it("keeps one cover and the gallery in order, replaced as a whole", async () => {
    const w = await walkerShop(t.db, "sm1");
    await saveShopMedia(t.db, w.shopId, { cover, gallery: [{ url: "https://cdn.test/a.jpg", altEn: "A" }, { url: "https://cdn.test/b.jpg", altEn: "B", wide: true }] });
    let page = (await publicShop(t.db, "pattes-sm1"))!;
    expect(page.media.cover).toMatchObject({ url: "https://cdn.test/cover.jpg", webmUrl: "https://cdn.test/cover.webm", altEn: "A dog" });
    expect(page.media.gallery.map((g) => g.altEn)).toEqual(["A", "B"]);
    expect(page.media.gallery[1]!.wide).toBe(true);
    await saveShopMedia(t.db, w.shopId, { gallery: [{ url: "https://cdn.test/c.jpg", altEn: "C" }] });
    page = (await publicShop(t.db, "pattes-sm1"))!;
    expect(page.media.cover).toBeNull();
    expect(page.media.gallery.map((g) => g.altEn)).toEqual(["C"]);
  });
  it("accepts https addresses only", async () => {
    const w = await walkerShop(t.db, "sm2");
    await expect(saveShopMedia(t.db, w.shopId, { cover: { ...cover, url: "http://cdn.test/cover.jpg" } })).rejects.toThrow();
    await expect(saveShopMedia(t.db, w.shopId, { gallery: [{ url: "javascript:alert(1)" }] })).rejects.toThrow();
  });
  it("has no media and still renders for a shop that never added any", async () => {
    await walkerShop(t.db, "sm3");
    expect((await publicShop(t.db, "pattes-sm3"))!.media).toEqual({ cover: null, gallery: [] });
  });
});

describe("« Popular », from the real bookings", () => {
  it("tags none for a new shop, then the strictly most booked service once it has three bookings", async () => {
    const w = await walkerShop(t.db, "pop");
    expect((await publicShop(t.db, "pattes-pop"))!.popularServiceId).toBeNull();
    const dogs = [w.camille, w.jordan];
    for (let i = 0; i < 3; i++) {
      const who = dogs[i % 2]!;
      const slots = await listSlots(t.db, { shopId: w.shopId, serviceId: w.solo, zoneId: w.zones.stHenri, now: NOW });
      await bookVisit(t.db, { clientId: who.clientId, serviceId: w.solo, zoneId: w.zones.stHenri, dependantIds: [who.dogId], startsAt: slots[0]!.startsAt, now: NOW });
    }
    expect((await publicShop(t.db, "pattes-pop"))!.popularServiceId).toBe(w.solo);
  });
});
