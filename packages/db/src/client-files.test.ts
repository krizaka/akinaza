import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { clientFile, clientOverview } from "./client-files";
import { appointments, clients } from "./schema";
import { book, creditNote, issueInvoice } from "./shop-ops";
import { freshDatabase } from "./test/db";
import { salon } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const NOW = new Date("2026-10-22T15:00:00Z");
const hoursFrom = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

describe("the client files of a shop", () => {
  it("counts the visits that began, names the last and the next, and sums what was billed minus credit notes", async () => {
    const s = await salon(t.db);
    const common = { shopId: s.shop.id, staffId: s.staff.julie.id, serviceId: s.services.cut.id, clientId: s.client.id };
    const past = await book(t.db, { ...common, startsAt: hoursFrom(-48) });
    await book(t.db, { ...common, startsAt: hoursFrom(-24) });
    const missed = await book(t.db, { ...common, startsAt: hoursFrom(-12) });
    const cancelled = await book(t.db, { ...common, startsAt: hoursFrom(-6) });
    await book(t.db, { ...common, startsAt: hoursFrom(26) });
    await book(t.db, { ...common, startsAt: hoursFrom(50) });
    await t.db.update(appointments).set({ status: "done" }).where(eq(appointments.id, past.id));
    await t.db.update(appointments).set({ status: "noShow" }).where(eq(appointments.id, missed.id));
    await t.db.update(appointments).set({ status: "cancelled" }).where(eq(appointments.id, cancelled.id));
    const line = { description: "Haircut", quantity: 1, unitPriceCents: 4_500, category: "standard" as const };
    const first = await issueInvoice(t.db, { shopId: s.shop.id, clientId: s.client.id, language: "fr", issuedOn: "2026-10-20", lines: [line] });
    await issueInvoice(t.db, { shopId: s.shop.id, clientId: s.client.id, language: "fr", issuedOn: "2026-10-21", lines: [line] });
    await creditNote(t.db, first.invoice.id, "2026-10-22");

    const [row] = await clientOverview(t.db, s.shop.id, NOW);
    expect(row).toMatchObject({ id: s.client.id, fullName: "Camille Tremblay", visits: 2, spentCents: first.totals.totalCents });
    expect(row!.lastVisitAt).toBe(hoursFrom(-24).toISOString());
    expect(row!.nextVisitAt).toBe(hoursFrom(26).toISOString());
  });

  it("lists a client with no visit and no invoice with zeros and no dates, and never another shop's client", async () => {
    const a = await salon(t.db);
    const b = await salon(t.db);
    await t.db.insert(clients).values({ shopId: a.shop.id, fullName: "Zoé Nouvelle" });
    const rows = await clientOverview(t.db, a.shop.id, NOW);
    expect(rows.map((r) => r.fullName)).toEqual(["Camille Tremblay", "Zoé Nouvelle"]);
    expect(rows[1]).toMatchObject({ visits: 0, lastVisitAt: null, nextVisitAt: null, spentCents: 0 });
    expect(rows.map((r) => r.id)).not.toContain(b.client.id);
  });

  it("opens a file with its visits newest first and its invoices, and refuses another shop's client", async () => {
    const a = await salon(t.db);
    const b = await salon(t.db);
    const common = { shopId: a.shop.id, staffId: a.staff.marc.id, serviceId: a.services.colour.id, clientId: a.client.id };
    await book(t.db, { ...common, startsAt: hoursFrom(-72) });
    await book(t.db, { ...common, startsAt: hoursFrom(30) });
    await issueInvoice(t.db, { shopId: a.shop.id, clientId: a.client.id, language: "fr", issuedOn: "2026-10-19", lines: [{ description: "Colour", quantity: 1, unitPriceCents: 9_500, category: "standard" }] });

    const file = await clientFile(t.db, a.shop.id, a.client.id);
    expect(file!.client).toMatchObject({ fullName: "Camille Tremblay", language: "fr", hasAccessNotes: false });
    expect(file!.visits.map((v) => v.startsAt)).toEqual([hoursFrom(30).toISOString(), hoursFrom(-72).toISOString()]);
    expect(file!.visits[0]).toMatchObject({ staff: "Marc", priceCents: 9_500, service: { en: "Colour" } });
    expect(file!.invoices).toHaveLength(1);
    expect(await clientFile(t.db, b.shop.id, a.client.id)).toBeNull();
  });
});
