import { randomBytes } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "./schema";
import { seedSaintHenri, SAINT_HENRI, SAINT_HENRI_EMAILS } from "./seed-walker";
import { resetWalkerPersona } from "./qa-reset-walker";
import { shopOfOwner } from "./service-shop";
import { freshDatabase } from "./test/db";
import { clientBookings, shopClients } from "./visits";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
  await t.db.insert(accounts).values(SAINT_HENRI_EMAILS.map((email) => ({ email, passwordHash: "x" })));
});
afterAll(async () => t.drop());

const NOW = new Date("2026-10-21T15:00:00Z"); // Wednesday 11:00 in Montréal

/** The bookings a client has that still stand, in the future. */
async function openFuture(clientId: string, now: Date): Promise<number> {
  const rows = await t.db.execute(sql`
    SELECT count(*)::int AS n FROM bookings b JOIN appointments a ON a.id = b.appointment_id
     WHERE b.client_id = ${clientId} AND b.status = 'booked' AND a.status = 'booked' AND lower(a.during) > ${now.toISOString()}::timestamptz`);
  return (rows.rows[0] as { n: number }).n;
}

describe("the walker persona reset", () => {
  it("cancels the future bookings, keeps the past walk, and leaves one open upcoming visit per client", async () => {
    const seeded = await seedSaintHenri(t.db, randomBytes(32), NOW);
    const owner = (await t.db.select().from(accounts).where(eq(accounts.email, SAINT_HENRI_EMAILS[0])))[0]!;
    const shop = (await shopOfOwner(t.db, owner.id))!;
    const camille = seeded.clientIds[SAINT_HENRI.clients[0]!.email]!;
    const before = await clientBookings(t.db, camille);

    const result = await resetWalkerPersona(t.db, shop.id, NOW);
    expect(result.cancelled).toBe(2); // the seeded group walk: Luna and Érable
    expect(result.recreated).toBe(5);

    const clients = await shopClients(t.db, shop.id);
    for (const c of clients) expect(await openFuture(c.id, NOW)).toBe(1);

    // The past walk stays exactly as it was: done, with its report.
    const after = await clientBookings(t.db, camille);
    expect(after.filter((b) => b.visitStatus === "done")).toEqual(before.filter((b) => b.visitStatus === "done"));
  });

  it("is idempotent: a second reset leaves the same single open visit per client", async () => {
    const owner = (await t.db.select().from(accounts).where(eq(accounts.email, SAINT_HENRI_EMAILS[0])))[0]!;
    const shop = (await shopOfOwner(t.db, owner.id))!;
    await resetWalkerPersona(t.db, shop.id, NOW);
    const clients = await shopClients(t.db, shop.id);
    for (const c of clients) expect(await openFuture(c.id, NOW)).toBe(1);
  });
});
