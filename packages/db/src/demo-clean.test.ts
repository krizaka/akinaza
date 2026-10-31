import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { cleanDemoLeftovers, demoLeftovers, type DemoCast } from "./demo-clean";
import { accounts, appointments, clients, dependants } from "./schema";
import { addDependant, bookVisit, joinShop } from "./service-shop";
import { freshDatabase } from "./test/db";
import { account, NOW, walkerShop } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

describe("demo-clean (real PostgreSQL 16)", () => {
  it("removes the dog, the visit and the client a journey left, and nothing of the cast", async () => {
    const s = await walkerShop(t.db);
    const cast: DemoCast = {
      shopSlug: "pattes-a",
      clients: [
        { email: "camille-a@example.test", dogs: ["Rex"] },
        { email: "jordan-a@example.test", dogs: ["Luna"] },
      ],
    };
    expect(await demoLeftovers(t.db, cast)).toEqual({ clients: [], dogs: [] });

    // What a journey adds: a second dog booked on a walk, and a visitor's own client file with a dog and a walk.
    const miso = await addDependant(t.db, s.camille.clientId, { kind: "dog", name: "Miso", profile: {} });
    const visit = await bookVisit(t.db, { clientId: s.camille.clientId, serviceId: s.group, zoneId: s.zones.stHenri, dependantIds: [miso], startsAt: new Date("2026-10-20T13:00:00Z"), now: NOW });
    const stranger = await account(t.db, "someone-real@example.test");
    const joined = await joinShop(t.db, stranger.id, stranger.email, s.shopId, { fullName: "Someone Real", phone: "514-555-0199", language: "fr", consentService: true, consentReminders: false });
    const rex = await addDependant(t.db, joined.clientId, { kind: "dog", name: "Rex", profile: {} });
    await bookVisit(t.db, { clientId: joined.clientId, serviceId: s.solo, zoneId: s.zones.stHenri, dependantIds: [rex], startsAt: new Date("2026-10-21T13:00:00Z"), now: NOW });

    const found = await demoLeftovers(t.db, cast);
    expect(found.dogs).toEqual([miso]);
    expect(found.clients).toEqual([joined.clientId]);

    const done = await cleanDemoLeftovers(t.db, cast);
    expect(done).toMatchObject({ clients: 1, dogs: 1, bookings: 2, visits: 2 });
    expect(await demoLeftovers(t.db, cast)).toEqual({ clients: [], dogs: [] });
    // The cast is untouched, and the visitor's sign-in (used by nothing else) is gone with the file.
    expect((await t.db.select().from(dependants).where(eq(dependants.id, s.camille.dogId))).length).toBe(1);
    expect((await t.db.select().from(clients).where(eq(clients.id, s.jordan.clientId))).length).toBe(1);
    expect((await t.db.select().from(accounts).where(eq(accounts.id, stranger.id))).length).toBe(0);
    expect((await t.db.select().from(appointments).where(eq(appointments.id, visit.appointmentId))).length).toBe(0);
  });

  it("is idempotent: a second run removes nothing", async () => {
    const done = await cleanDemoLeftovers(t.db, { shopSlug: "pattes-a", clients: [{ email: "camille-a@example.test", dogs: ["Rex"] }, { email: "jordan-a@example.test", dogs: ["Luna"] }] });
    expect(done).toEqual({ clients: 0, dogs: 0, bookings: 0, visits: 0, accounts: 0, kept: 0 });
  });
});
