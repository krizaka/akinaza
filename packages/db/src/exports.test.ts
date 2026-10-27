import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { exportAppointments, exportClients, exportInvoices } from "./exports";
import { clients, dependants } from "./schema";
import { book, issueInvoice } from "./shop-ops";
import { freshDatabase } from "./test/db";
import { salon } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

async function all<T>(stream: AsyncGenerator<T[]>): Promise<T[]> {
  const out: T[] = [];
  for await (const batch of stream) out.push(...batch);
  return out;
}

describe("the owner's data exports (#420), on a real PostgreSQL", () => {
  it("exports the appointments with their service, staff and client, oldest first, in batches without a gap or a repeat", async () => {
    const s = await salon(t.db);
    const days = [20, 21, 22, 23, 24];
    for (const d of days) await book(t.db, { shopId: s.shop.id, staffId: s.staff.julie.id, serviceId: s.services.cut.id, clientId: s.client.id, startsAt: new Date(`2026-11-${d}T15:00:00Z`) });
    const rows = await all(exportAppointments(t.db, s.shop.id, 2));
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((r) => r.id)).size).toBe(5);
    expect(rows.map((r) => r.startsAt.toISOString())).toEqual(days.map((d) => `2026-11-${d}T15:00:00.000Z`));
    expect(rows[0]).toMatchObject({ serviceFr: "Coupe", serviceEn: "Haircut", staff: "Julie", client: "Camille Tremblay", priceCents: 4_500, status: "booked" });
    expect(rows[0]!.endsAt.getTime() - rows[0]!.startsAt.getTime()).toBe(45 * 60_000);
  });

  it("never reads another shop's rows, and names no client who was erased", async () => {
    const a = await salon(t.db);
    const b = await salon(t.db);
    await book(t.db, { shopId: b.shop.id, staffId: b.staff.julie.id, serviceId: b.services.cut.id, clientId: b.client.id, startsAt: new Date("2026-12-01T15:00:00Z") });
    expect(await all(exportAppointments(t.db, a.shop.id))).toEqual([]);
    expect(await all(exportClients(t.db, a.shop.id))).toHaveLength(1);
    expect((await all(exportClients(t.db, a.shop.id))).map((c) => c.id)).toEqual([a.client.id]);
    await t.db.update(clients).set({ email: null, phone: null, erasedAt: new Date() }).where(eq(clients.id, b.client.id));
    expect((await all(exportAppointments(t.db, b.shop.id)))[0]!.client).toBe("");
    expect(await all(exportClients(t.db, b.shop.id))).toEqual([]);
  });

  it("exports the clients by name with their dependants, and never an access note", async () => {
    const s = await salon(t.db);
    await t.db.insert(dependants).values([{ shopId: s.shop.id, clientId: s.client.id, kind: "dog", name: "Rex" }, { shopId: s.shop.id, clientId: s.client.id, kind: "cat", name: "Minou" }]);
    for (const name of ["Zoé Roy", "Alice Gagnon", "Marc Côté"]) await t.db.insert(clients).values({ shopId: s.shop.id, fullName: name, accessNotesEnc: "v1.a.b.c" });
    const rows = await all(exportClients(t.db, s.shop.id, 2));
    expect(rows.map((r) => r.fullName)).toEqual(["Alice Gagnon", "Camille Tremblay", "Marc Côté", "Zoé Roy"]);
    expect(rows[1]).toMatchObject({ email: "camille@example.test", phone: "514-555-0199", language: "fr", dependants: ["Minou", "Rex"] });
    expect(JSON.stringify(rows)).not.toMatch(/accessNotes|v1\.a\.b\.c/);
  });

  it("exports the invoices in the order of the books, with the amounts in cents and the client's name", async () => {
    const s = await salon(t.db);
    const line = { description: "Coupe", quantity: 1, unitPriceCents: 4_500, category: "standard" as const };
    for (const issuedOn of ["2026-10-01", "2026-10-02", "2026-10-03"]) await issueInvoice(t.db, { shopId: s.shop.id, clientId: s.client.id, language: "fr", issuedOn, lines: [line] });
    const rows = await all(exportInvoices(t.db, s.shop.id, 2));
    expect(rows.map((r) => r.issuedOn)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(rows[0]).toMatchObject({ client: "Camille Tremblay", subtotalCents: 4_500, paidCents: 0, superseded: false, creditOf: null });
    expect(rows[0]!.totalCents).toBe(rows[0]!.subtotalCents + rows[0]!.gstCents + rows[0]!.qstCents);
  });
});
