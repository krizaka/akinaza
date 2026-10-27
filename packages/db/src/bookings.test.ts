import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { book, eraseClient, issueInvoice, recordConsent } from "./shop-ops";
import { consentHistoryOf } from "./privacy";
import { appointments, clients } from "./schema";
import { freshDatabase, refusal } from "./test/db";
import { salon } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const at = (iso: string) => new Date(iso);

describe("bookings (real PostgreSQL 16)", () => {
  it("books a service for its duration and announces the slot taken", async () => {
    const s = await salon(t.db);
    const r = await book(t.db, { shopId: s.shop.id, staffId: s.staff.julie.id, serviceId: s.services.cut.id, clientId: s.client.id, startsAt: at("2026-10-15T13:00:00Z") });
    expect(r.event).toEqual({ type: "slot", shopId: s.shop.id, staffId: s.staff.julie.id, startsAt: "2026-10-15T13:00:00.000Z", endsAt: "2026-10-15T13:45:00.000Z", status: "taken" });
  });

  it("never books one person twice at once — the database refuses the overlap", async () => {
    const s = await salon(t.db);
    await book(t.db, { shopId: s.shop.id, staffId: s.staff.julie.id, serviceId: s.services.colour.id, startsAt: at("2026-10-15T14:00:00Z") });
    expect(await refusal(book(t.db, { shopId: s.shop.id, staffId: s.staff.julie.id, serviceId: s.services.cut.id, startsAt: at("2026-10-15T15:00:00Z") }))).toMatch(/appointments_no_double_booking/);
    // Another stylist at the same time, and Julie right after: both fine.
    await book(t.db, { shopId: s.shop.id, staffId: s.staff.marc.id, serviceId: s.services.cut.id, startsAt: at("2026-10-15T15:00:00Z") });
    await book(t.db, { shopId: s.shop.id, staffId: s.staff.julie.id, serviceId: s.services.cut.id, startsAt: at("2026-10-15T15:30:00Z") });
  });

  it("frees the slot when an appointment is cancelled", async () => {
    const s = await salon(t.db);
    const first = await book(t.db, { shopId: s.shop.id, staffId: s.staff.marc.id, serviceId: s.services.cut.id, startsAt: at("2026-10-16T13:00:00Z") });
    await t.db.update(appointments).set({ status: "cancelled" }).where(eq(appointments.id, first.id));
    await book(t.db, { shopId: s.shop.id, staffId: s.staff.marc.id, serviceId: s.services.cut.id, startsAt: at("2026-10-16T13:15:00Z") });
  });
});

describe("the client file and Loi 25 (real PostgreSQL 16)", () => {
  it("keeps every consent decision, never edits one", async () => {
    const s = await salon(t.db);
    await recordConsent(t.db, s.client.id, "reminders", true, "2026-10-15");
    await recordConsent(t.db, s.client.id, "reminders", false, "2026-10-15");
    const rows = await consentHistoryOf(t.db, s.client.id);
    expect(rows.map((r) => r.granted)).toEqual([true, false]);
    expect(await refusal(t.db.execute(sql`UPDATE privacy.consent SET granted = true WHERE subject_id = ${s.client.id}`))).toMatch(/written once/);
  });

  it("erases a client's personal information but keeps the invoices that name them", async () => {
    const s = await salon(t.db);
    const { invoice } = await issueInvoice(t.db, { shopId: s.shop.id, clientId: s.client.id, language: "fr", issuedOn: "2026-10-15", lines: [{ description: "Coupe", quantity: 1, unitPriceCents: 4_500, category: "standard" }] });
    expect(await eraseClient(t.db, s.client.id, "2026-10-15")).toBe(true);
    const [c] = await t.db.select().from(clients).where(eq(clients.id, s.client.id));
    expect(c).toMatchObject({ fullName: "—", email: null, phone: null, notes: null });
    expect(c!.erasedAt).not.toBeNull();
    expect(invoice.clientId).toBe(s.client.id);
    expect(await eraseClient(t.db, s.client.id, "2026-10-15")).toBe(false);
    // An erased file cannot quietly get its e-mail back.
    expect(await refusal(t.db.update(clients).set({ email: "back@example.test" }).where(eq(clients.id, s.client.id)))).toMatch(/clients_erased/);
  });
});
