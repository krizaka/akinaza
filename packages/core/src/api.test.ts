import { describe, expect, it } from "vitest";

import { calendarAnswer, clientsAnswer, dayAnswer, invoicesAnswer, issuedInvoice, shopAnswer } from "./api";

const booking = {
  bookingId: "b1",
  clientId: "c1",
  clientName: "Camille Roy",
  clientPhone: "514-555-0100",
  dependant: { name: "Rex", kind: "dog", profile: { size: "large" } },
  hasAccessNotes: false,
  report: null,
};

describe("what the owner's API answers, as the apps parse it", () => {
  it("a day with its visits and who is booked on each", () => {
    const answer = {
      day: "2026-10-20",
      visits: [{ appointmentId: "a1", startsAt: "2026-10-20T13:00:00.000Z", endsAt: "2026-10-20T14:00:00.000Z", status: "booked", service: { fr: "Promenade", en: "Walk", capacity: 3 }, zone: "Saint-Henri", checkedInAt: null, checkedOutAt: null, bookings: [booking] }],
    };
    expect(dayAnswer.parse(answer).visits[0]?.bookings[0]?.dependant.name).toBe("Rex");
    expect(dayAnswer.safeParse({ ...answer, visits: [{ ...answer.visits[0], status: "lost" }] }).success).toBe(false);
  });

  it("a calendar, the clients, the invoices and the shop", () => {
    expect(calendarAnswer.parse({ days: [{ day: "2026-10-20", visits: 1, bookings: 2 }] }).days).toHaveLength(1);
    expect(clientsAnswer.parse({ clients: [{ id: "c1", fullName: "Camille Roy", phone: null, email: "c@example.test", hasNotes: true, dependants: [{ id: "d1", name: "Rex", kind: "dog", profile: {} }] }] }).clients[0]?.hasNotes).toBe(true);
    expect(invoicesAnswer.parse({ invoices: [{ id: "i1", number: "F-0001", issuedOn: "2026-10-20", dueOn: null, language: "fr", creditOf: null, subtotalCents: 4500, gstCents: 225, qstCents: 449, totalCents: 5174, client: null }] }).invoices[0]?.totalCents).toBe(5174);
    expect(shopAnswer.parse({ shop: { id: "s1", name: "Les Chiens de Saint-Henri", registrant: true, timezone: "America/Toronto", paymentTermsDays: 30 }, services: [{ id: "v1", nameFr: "Promenade", nameEn: "Walk", priceCents: 2500, taxCategory: "standard" }] }).services).toHaveLength(1);
    expect(issuedInvoice.parse({ id: "i1", number: 12, subtotalCents: 1, gstCents: 0, qstCents: 0, totalCents: 1 }).number).toBe(12);
  });
});
