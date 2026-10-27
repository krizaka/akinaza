import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { addConnection, agendaConflicts, busyBetween, claimDueConnections, listConnections, recordSyncFailure, recordSyncOk, removeConnection } from "./calendar-connections";
import { busyIntervals, calendarConnections } from "./schema";
import { bookVisit, listSlots } from "./service-shop";
import { freshDatabase } from "./test/db";
import { NOW, walkerShop } from "./test/fixtures";
import { dayVisits } from "./visits";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const base = (shopId: string, n: number) => ({ id: crypto.randomUUID(), shopId, staffId: null, kind: "ics" as const, label: `Agenda ${n}`, secretEnc: "v1.sealed", consentTextVersion: "2026-10-26", now: NOW, max: 3 });
const at = (iso: string) => new Date(iso);

describe("calendar sources (#282, ADR-004), on a real PostgreSQL", () => {
  it("connects within the bound, lists without the secret, and disconnecting deletes the busy times with it", async () => {
    const w = await walkerShop(t.db, "cal1");
    const c = await addConnection(t.db, base(w.shopId, 1));
    expect(c).toMatchObject({ kind: "ics", state: "pending", label: "Agenda 1" });
    expect(JSON.stringify(await listConnections(t.db, w.shopId))).not.toContain("sealed");
    await recordSyncOk(t.db, { id: c.id, shopId: w.shopId, staffId: null }, { busy: [{ startsAt: at("2026-10-20T14:00:00Z"), endsAt: at("2026-10-20T15:00:00Z") }], validators: { etag: '"e1"', lastModified: null } }, NOW, 30);
    expect(await t.db.select().from(busyIntervals).where(eq(busyIntervals.connectionId, c.id))).toHaveLength(1);
    expect(await removeConnection(t.db, w.shopId, c.id)).toBe(true);
    expect(await t.db.select().from(busyIntervals).where(eq(busyIntervals.connectionId, c.id))).toHaveLength(0);
    expect(await removeConnection(t.db, w.shopId, c.id)).toBe(false);
  });

  it("refuses beyond the administrator's bound and a staff member of another shop", async () => {
    const w = await walkerShop(t.db, "cal2");
    const other = await walkerShop(t.db, "cal3");
    for (let i = 0; i < 3; i++) await addConnection(t.db, base(w.shopId, i));
    await expect(addConnection(t.db, base(w.shopId, 9))).rejects.toMatchObject({ code: "AK_CALENDAR_LIMIT" });
    const [stranger] = await t.db.query.staff.findMany({ where: (s, { eq: is }) => is(s.shopId, other.shopId) });
    await expect(addConnection(t.db, { ...base(other.shopId, 1), shopId: w.shopId, staffId: stranger!.id })).rejects.toMatchObject({ code: "AK_STAFF_UNKNOWN" });
  });

  it("busy time blocks the slots it covers and frees them when the calendar is disconnected", async () => {
    const w = await walkerShop(t.db, "cal4");
    const q = { shopId: w.shopId, serviceId: w.solo, zoneId: w.zones.stHenri, now: NOW };
    const before = await listSlots(t.db, q);
    const tuesday = before.filter((s) => s.startsAt.toISOString().startsWith("2026-10-20"));
    expect(tuesday.length).toBeGreaterThan(1);
    const c = await addConnection(t.db, base(w.shopId, 1));
    // Tuesday 10:00–11:00 local (14:00–15:00Z) is taken elsewhere.
    await recordSyncOk(t.db, { id: c.id, shopId: w.shopId, staffId: null }, { busy: [{ startsAt: at("2026-10-20T14:00:00Z"), endsAt: at("2026-10-20T15:00:00Z") }], validators: { etag: null, lastModified: null } }, NOW, 30);
    const during = (await listSlots(t.db, q)).map((s) => s.startsAt.toISOString());
    expect(during).not.toContain("2026-10-20T14:00:00.000Z");
    expect(during).toContain("2026-10-20T15:00:00.000Z"); // touching ends do not overlap
    expect(during).toContain(before[0]!.startsAt.toISOString()); // other days untouched
    await removeConnection(t.db, w.shopId, c.id);
    expect((await listSlots(t.db, q)).map((s) => s.startsAt.toISOString())).toContain("2026-10-20T14:00:00.000Z");
  });

  it("a connection of one staff member blocks only that person; booking refuses a blocked time", async () => {
    const w = await walkerShop(t.db, "cal5");
    const [member] = await t.db.query.staff.findMany({ where: (s, { eq: is }) => is(s.shopId, w.shopId) });
    const c = await addConnection(t.db, { ...base(w.shopId, 1), staffId: member!.id });
    await recordSyncOk(t.db, { id: c.id, shopId: w.shopId, staffId: member!.id }, { busy: [{ startsAt: at("2026-10-20T14:00:00Z"), endsAt: at("2026-10-20T15:00:00Z") }], validators: { etag: null, lastModified: null } }, NOW, 30);
    expect(await busyBetween(t.db, w.shopId, member!.id, { from: at("2026-10-20T00:00:00Z"), to: at("2026-10-21T00:00:00Z") })).toHaveLength(1);
    await expect(bookVisit(t.db, { clientId: w.camille.clientId, serviceId: w.solo, zoneId: w.zones.stHenri, dependantIds: [w.camille.dogId], startsAt: at("2026-10-20T14:00:00Z"), now: NOW })).rejects.toMatchObject({ code: "AK_SLOT_UNAVAILABLE" });
  });

  it("flags an appointment that overlaps the owner's agenda, and deletes neither side", async () => {
    const w = await walkerShop(t.db, "cal6");
    const booked = await bookVisit(t.db, { clientId: w.camille.clientId, serviceId: w.solo, zoneId: w.zones.stHenri, dependantIds: [w.camille.dogId], startsAt: at("2026-10-20T14:00:00Z"), now: NOW });
    const c = await addConnection(t.db, { ...base(w.shopId, 1), label: "Google" });
    expect(await agendaConflicts(t.db, [booked.appointmentId])).toEqual(new Map());
    // The owner then adds a meeting in their calendar over the booked visit.
    await recordSyncOk(t.db, { id: c.id, shopId: w.shopId, staffId: null }, { busy: [{ startsAt: at("2026-10-20T14:30:00Z"), endsAt: at("2026-10-20T16:00:00Z") }], validators: { etag: null, lastModified: null } }, NOW, 30);
    expect(await agendaConflicts(t.db, [booked.appointmentId])).toEqual(new Map([[booked.appointmentId, "Google"]]));
    const day = await dayVisits(t.db, w.shopId, "2026-10-20");
    expect(day.find((v) => v.appointmentId === booked.appointmentId)?.agendaConflict).toBe("Google");
    expect(day.find((v) => v.appointmentId === booked.appointmentId)?.status).toBe("booked");
  });

  it("claims what is due once (a lease), backs off on failure and keeps the last busy times", async () => {
    const w = await walkerShop(t.db, "cal7");
    const c = await addConnection(t.db, base(w.shopId, 1));
    const first = await claimDueConnections(t.db, NOW, 10, 5);
    expect(first.map((d) => d.id)).toContain(c.id);
    expect((await claimDueConnections(t.db, NOW, 10, 5)).map((d) => d.id)).not.toContain(c.id);
    await recordSyncOk(t.db, { id: c.id, shopId: w.shopId, staffId: null }, { busy: [{ startsAt: at("2026-10-21T14:00:00Z"), endsAt: at("2026-10-21T15:00:00Z") }], validators: { etag: '"x"', lastModified: null } }, NOW, 30);
    await recordSyncFailure(t.db, { id: c.id, failures: 0 }, "AK_CAL_UNREACHABLE", NOW, 30);
    const [row] = await t.db.select().from(calendarConnections).where(eq(calendarConnections.id, c.id));
    expect(row).toMatchObject({ state: "error", failures: 1, lastError: "AK_CAL_UNREACHABLE", etag: '"x"' });
    expect(row!.nextSyncAt.toISOString()).toBe("2026-10-19T13:00:00.000Z"); // 12:00Z + 60 minutes (30 doubled once)
    expect(await t.db.select().from(busyIntervals).where(eq(busyIntervals.connectionId, c.id))).toHaveLength(1);
    // An unchanged answer keeps the busy times and the validators, and ends the error.
    await recordSyncOk(t.db, { id: c.id, shopId: w.shopId, staffId: null }, null, NOW, 30);
    expect(await t.db.select().from(busyIntervals).where(eq(busyIntervals.connectionId, c.id))).toHaveLength(1);
    expect((await listConnections(t.db, w.shopId))[0]).toMatchObject({ state: "ok", lastError: null });
  });
});
