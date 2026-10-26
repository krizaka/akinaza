import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { type DayVisitView, VisitBookings, VisitProgress } from "./VisitDetail";

const vocabulary = vi.hoisted(() => ({ dependants: true, visitReports: false }));
vi.mock("@/lib/i18n-client", () => ({
  useSay: () => ({ say: (key: string, vars?: Record<string, string | number>) => (vars ? `${key} ${Object.values(vars).join(" ")}` : key), locale: "fr" }),
  useVocabulary: () => ({ type: "pets", ...vocabulary }),
}));
vi.mock("@/components/app/useCall", () => ({ useCall: () => ({ run: vi.fn(), pending: false, problem: null }) }));
vi.mock("@/components/app/AccessNotes", () => ({ AccessNotes: ({ clientName }: { clientName: string }) => <details data-testid="access-notes">{clientName}</details> }));

const walk: DayVisitView = {
  appointmentId: "a-1",
  startsAt: "2026-10-23T18:00:00.000Z",
  endsAt: "2026-10-23T19:00:00.000Z",
  status: "booked",
  service: { fr: "Promenade en groupe 60 min", en: "Group walk 60 min", capacity: 5 },
  zone: "Saint-Henri",
  checkedInAt: null,
  checkedOutAt: null,
  minutes: null,
  bookings: [
    { bookingId: "b-1", clientId: "c-1", clientName: "Sofia Rossi", clientPhone: "514-555-0142", dependant: { name: "Rex", kind: "dog", profile: { breed: "Labrador", size: "large", temperament: "Calme" } }, hasAccessNotes: true, report: null },
    { bookingId: "b-2", clientId: "c-2", clientName: "Jordan Lee", clientPhone: null, dependant: { name: "Miso", kind: "dog", profile: {} }, hasAccessNotes: false, report: null },
  ],
};
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("what a walk holds, the same in the owner's side sheet and the walker's card", () => {
  it("lists each dog with its breed and size, its owner with a way to call, and the access notes folded", () => {
    const html = renderToStaticMarkup(<VisitBookings visit={walk} timeZone="America/Toronto" />);
    expect(text(html)).toContain("Rex Labrador · clients.sizes.large");
    expect(text(html)).toContain("Calme");
    expect(text(html)).toContain("walker.owner Sofia Rossi");
    expect(html).toContain('href="tel:5145550142"');
    expect(html.match(/data-testid="access-notes"/g)).toHaveLength(1);
    expect(text(html)).toContain("Miso");
  });

  it("offers to start a walk not begun, to end one begun, and tells when one ended", () => {
    expect(text(renderToStaticMarkup(<VisitProgress visit={walk} timeZone="America/Toronto" />))).toContain("walker.checkIn");
    const live = text(renderToStaticMarkup(<VisitProgress visit={{ ...walk, checkedInAt: "2026-10-23T18:02:00.000Z" }} timeZone="America/Toronto" />));
    expect(live).toContain("walker.startedAt 14 h 02");
    expect(live).toContain("walker.checkOut");
    const done = text(renderToStaticMarkup(<VisitProgress visit={{ ...walk, checkedInAt: "2026-10-23T18:02:00.000Z", checkedOutAt: "2026-10-23T18:54:00.000Z", minutes: 52 }} timeZone="America/Toronto" />));
    expect(done).toContain("walker.endedAt 14 h 54 52");
    expect(done).not.toContain("walker.checkIn");
    expect(done).not.toContain("walker.checkOut");
  });

  it("fills a phone's card with a big button only when asked (the sheet keeps it medium)", () => {
    expect(renderToStaticMarkup(<VisitProgress visit={walk} timeZone="America/Toronto" wide />)).toMatch(/\sw-full\b/);
    expect(renderToStaticMarkup(<VisitProgress visit={walk} timeZone="America/Toronto" />)).not.toMatch(/\sw-full\b/);
  });
});
