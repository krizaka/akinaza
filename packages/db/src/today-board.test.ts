import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { recordPayment } from "./invoice-payments";
import { book, issueShopInvoice } from "./shop-ops";
import { freshDatabase, refusal } from "./test/db";
import { salon } from "./test/fixtures";
import { todayBoard } from "./today-board";
import { checkIn, checkOut } from "./visits";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

// Friday 23 October 2026 in Montréal; its week runs from Monday the 19th to Sunday the 25th.
const DAY = "2026-10-23";

describe("Aujourd'hui's board (D4): the binder, the activity and the balance, from the bookings and the ledger (real PostgreSQL 16)", () => {
  it("counts the week, what is still to bill and what is still to collect, in integer cents, the shop's own", async () => {
    const s = await salon(t.db);
    const other = await salon(t.db);
    const at = (iso: string) => book(t.db, { shopId: s.shop.id, staffId: s.staff.julie.id, serviceId: s.services.cut.id, clientId: s.client.id, startsAt: new Date(iso) });
    const monday = await at("2026-10-19T14:00:00Z");
    const friday = await at("2026-10-23T14:00:00Z");
    await at("2026-10-26T14:00:00Z"); // next week
    await book(t.db, { shopId: other.shop.id, staffId: other.staff.julie.id, serviceId: other.services.cut.id, startsAt: new Date("2026-10-22T14:00:00Z") });
    for (const a of [monday, friday]) {
      await checkIn(t.db, s.shop.id, a.id, new Date("2026-10-19T14:00:00Z"));
      await checkOut(t.db, s.shop.id, a.id, new Date("2026-10-19T14:45:00Z"));
    }
    // Monday's appointment is billed (linked to its invoice); Friday's is not yet.
    const billed = await issueShopInvoice(t.db, s.shop.id, { clientId: s.client.id, appointmentId: monday.id, language: "fr", issuedOn: "2026-10-19", termsDays: 0, lines: [{ serviceId: s.services.cut.id, quantity: 1 }] });
    await recordPayment(t.db, s.shop.id, billed.invoice.id, { method: "card", amountCents: 2_000 }, new Date("2026-10-21T15:00:00Z"));
    const board = await todayBoard(t.db, s.shop.id, { day: DAY, period: 7 });
    expect(board.week).toBe(2);
    expect(board.toBill.map((a) => a.appointmentId)).toEqual([friday.id]);
    expect(board.toBill[0]).toMatchObject({ clientId: s.client.id, serviceId: s.services.cut.id, client: "Camille Tremblay" });
    // 45,00 $ + TPS 2,25 $ + TVQ 4,49 $ = 51,74 $; 20,00 $ received: 31,74 $ owed, overdue (due on receipt, on the 19th).
    expect(board.balance).toEqual({ owedCents: 3_174, overdueCents: 3_174, count: 1, overdueCount: 1 });
    expect(board.chase).toMatchObject({ id: billed.invoice.id, number: billed.invoice.number, remainingCents: 3_174, overdue: true });
    expect(board.activity.days).toHaveLength(7);
    expect(board.activity.days.at(-1)).toBe(DAY);
    expect(board.activity.invoicedCents.reduce((x, y) => x + y, 0)).toBe(5_174);
    expect(board.activity.collectedCents.reduce((x, y) => x + y, 0)).toBe(2_000);
    expect(board.activity.appointments.reduce((x, y) => x + y, 0)).toBe(2);
    expect(board.activity.invoicedCents.every(Number.isInteger)).toBe(true);
    expect((await todayBoard(t.db, other.shop.id, { day: DAY, period: 7 })).balance.count).toBe(0);
  });

  it("follows the period asked: 7, 30 or 90 days", async () => {
    const s = await salon(t.db);
    for (const period of [7, 30, 90] as const) expect((await todayBoard(t.db, s.shop.id, { day: DAY, period })).activity.days).toHaveLength(period);
  });

  it("refuses to link an invoice to another shop's appointment", async () => {
    const s = await salon(t.db);
    const other = await salon(t.db);
    const theirs = await book(t.db, { shopId: other.shop.id, staffId: other.staff.julie.id, serviceId: other.services.cut.id, startsAt: new Date("2026-10-22T14:00:00Z") });
    expect(await refusal(issueShopInvoice(t.db, s.shop.id, { appointmentId: theirs.id, language: "fr", issuedOn: DAY, lines: [{ serviceId: s.services.cut.id, quantity: 1 }] }))).toMatch(/AK_APPOINTMENT_UNKNOWN/);
  });
});
