import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { feedByTokenHash, feedEntries, feedEntriesAround, liveFeeds, revokeFeedToken, rotateFeedToken } from "./feed-tokens";
import { appointments, feedTokens } from "./schema";
import { book } from "./shop-ops";
import { freshDatabase } from "./test/db";
import { salon } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const hash = (c: string) => c.repeat(64);
const NOW = new Date("2026-10-26T12:00:00Z");

describe("the private calendar feeds (#282, ADR-004), on a real PostgreSQL", () => {
  it("opens a feed with its token's hash, and only the hash is kept", async () => {
    const s = await salon(t.db);
    const feed = await rotateFeedToken(t.db, { shopId: s.shop.id, staffId: null }, hash("a"), NOW);
    expect(feed).toMatchObject({ shopId: s.shop.id, staffId: null, rotatedAt: null });
    expect(await feedByTokenHash(t.db, hash("a"))).toEqual({ shopId: s.shop.id, staffId: null });
    expect(await feedByTokenHash(t.db, hash("b"))).toBeNull();
    const rows = await t.db.select().from(feedTokens).where(eq(feedTokens.shopId, s.shop.id));
    expect(rows.map((r) => r.tokenHash)).toEqual([hash("a")]);
  });

  it("a rotation kills the old address at once and leaves one live token", async () => {
    const s = await salon(t.db);
    const ref = { shopId: s.shop.id, staffId: s.staff.julie.id };
    await rotateFeedToken(t.db, ref, hash("1"), NOW);
    const next = await rotateFeedToken(t.db, ref, hash("2"), new Date("2026-10-26T13:00:00Z"));
    expect(next?.rotatedAt).not.toBeNull();
    expect(await feedByTokenHash(t.db, hash("1"))).toBeNull();
    expect(await feedByTokenHash(t.db, hash("2"))).toEqual(ref);
    expect(await liveFeeds(t.db, s.shop.id)).toHaveLength(1);
  });

  it("two rotations at the same time leave exactly one live token", async () => {
    const s = await salon(t.db);
    const ref = { shopId: s.shop.id, staffId: null };
    await Promise.all(["3", "4", "5", "6"].map((c) => rotateFeedToken(t.db, ref, hash(c), NOW)));
    expect(await liveFeeds(t.db, s.shop.id)).toHaveLength(1);
    const alive = await Promise.all(["3", "4", "5", "6"].map((c) => feedByTokenHash(t.db, hash(c))));
    expect(alive.filter(Boolean)).toHaveLength(1);
  });

  it("a revoked feed answers like an unknown one, and revoking twice is a no-op", async () => {
    const s = await salon(t.db);
    const ref = { shopId: s.shop.id, staffId: null };
    await rotateFeedToken(t.db, ref, hash("7"), NOW);
    expect(await revokeFeedToken(t.db, ref, NOW)).toBe(true);
    expect(await feedByTokenHash(t.db, hash("7"))).toBeNull();
    expect(await revokeFeedToken(t.db, ref, NOW)).toBe(false);
    expect(await liveFeeds(t.db, s.shop.id)).toEqual([]);
  });

  it("never opens a feed for another shop's staff member", async () => {
    const a = await salon(t.db);
    const b = await salon(t.db);
    expect(await rotateFeedToken(t.db, { shopId: a.shop.id, staffId: b.staff.julie.id }, hash("8"), NOW)).toBeNull();
    expect(await revokeFeedToken(t.db, { shopId: a.shop.id, staffId: b.staff.julie.id }, NOW)).toBe(false);
    expect(await feedByTokenHash(t.db, hash("8"))).toBeNull();
  });

  it("refuses a token that is not a 64-character hash", async () => {
    const s = await salon(t.db);
    await expect(rotateFeedToken(t.db, { shopId: s.shop.id, staffId: null }, "clear-token", NOW)).rejects.toThrow();
  });

  it("lists the appointments with first names and the service only, the staff feed with its own", async () => {
    const s = await salon(t.db);
    const other = await salon(t.db);
    const mine = await book(t.db, { shopId: s.shop.id, staffId: s.staff.julie.id, serviceId: s.services.cut.id, clientId: s.client.id, startsAt: new Date("2026-10-27T14:00:00Z") });
    const marc = await book(t.db, { shopId: s.shop.id, staffId: s.staff.marc.id, serviceId: s.services.colour.id, startsAt: new Date("2026-10-27T16:00:00Z") });
    const gone = await book(t.db, { shopId: s.shop.id, staffId: s.staff.julie.id, serviceId: s.services.cut.id, startsAt: new Date("2026-10-28T14:00:00Z") });
    await t.db.update(appointments).set({ status: "cancelled" }).where(eq(appointments.id, gone.id));
    await book(t.db, { shopId: other.shop.id, staffId: other.staff.julie.id, serviceId: other.services.cut.id, startsAt: new Date("2026-10-27T15:00:00Z") });
    const from = new Date("2026-10-26T00:00:00Z");
    const to = new Date("2026-11-30T00:00:00Z");
    const all = await feedEntries(t.db, { shopId: s.shop.id, staffId: null }, from, to);
    expect(all.map((e) => e.appointmentId)).toEqual([mine.id, marc.id]);
    expect(all[0]).toMatchObject({ firstNames: ["Camille"], service: { fr: "Coupe", en: "Haircut" }, status: "booked" });
    expect(JSON.stringify(all)).not.toMatch(/Tremblay|514-555|example\.test/);
    expect((await feedEntries(t.db, { shopId: s.shop.id, staffId: s.staff.marc.id }, from, to)).map((e) => e.appointmentId)).toEqual([marc.id]);
    // Around an instant: a fortnight behind and four months ahead are counted by the database; an appointment outside is left out.
    const around = await feedEntriesAround(t.db, { shopId: s.shop.id, staffId: null }, NOW, 14, 120);
    expect(around.map((e) => e.appointmentId)).toEqual([mine.id, marc.id]);
    expect(await feedEntriesAround(t.db, { shopId: s.shop.id, staffId: null }, NOW, 14, 0)).toEqual([]);
    expect(await feedEntries(t.db, { shopId: s.shop.id, staffId: null }, new Date("2027-01-01T00:00:00Z"), new Date("2027-02-01T00:00:00Z"))).toEqual([]);
  });
});
