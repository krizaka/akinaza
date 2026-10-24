import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { shopRoutes } from "@/lib/routes";

import { TodayDay, type TodayDayProps } from "./TodayDay";
import type { DayVisitView } from "./VisitDetail";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => "/fr/app/s-1/aujourdhui" }));
vi.mock("@/lib/i18n-client", () => ({
  useSay: () => ({ say: (key: string, vars?: Record<string, string | number>) => (vars ? `${key} ${Object.values(vars).join(" ")}` : key), locale: "fr" }),
  useVocabulary: () => ({ type: "pets", dependants: true, visitReports: true }),
}));
vi.mock("@/components/app/ShopSession", () => ({ useShopRoutes: () => shopRoutes("fr", "s-1") }));
vi.mock("@/components/app/useCall", () => ({ useCall: () => ({ run: vi.fn(), pending: false, problem: null }) }));
vi.mock("@/components/app/AccessNotes", () => ({ AccessNotes: () => null }));

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
    { bookingId: "b-1", clientId: "c-1", clientName: "Sofia Rossi", clientPhone: "514-555-0142", dependant: { name: "Rex", kind: "dog", profile: { breed: "Labrador", size: "large" } }, hasAccessNotes: true, report: null },
    { bookingId: "b-2", clientId: "c-2", clientName: "Jordan Lee", clientPhone: null, dependant: { name: "Miso", kind: "dog", profile: {} }, hasAccessNotes: false, report: null },
  ],
};

const base: TodayDayProps = {
  appointments: [{ id: "a-1", startsAt: walk.startsAt, endsAt: walk.endsAt, staff: "Léa", service: { fr: walk.service.fr, en: walk.service.en }, clientId: "c-1", client: "Sofia Rossi", status: "booked", checkedInAt: null, priceCents: 3_500, category: "standard" }],
  shop: { timezone: "America/Toronto", registrant: true },
  day: "2026-10-23",
  today: "2026-10-23",
  nowIso: "2026-10-23T17:30:00.000Z",
  selectedId: null,
  allow: { clients: true, revenue: true },
  title: "Aujourd'hui",
  description: "vendredi 23 octobre 2026",
  visits: { "a-1": walk },
};
const render = (props: Partial<TodayDayProps>) => renderToStaticMarkup(<TodayDay {...base} {...props} />);
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

describe("the owner's day as an agenda, for a dog walker too (docs/ux/2026-10-full-review.md B1–B5)", () => {
  it("reads a walk by its service and its dogs, with the page's one h1, the figures and the « now » line", () => {
    const html = render({});
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(text(html)).toContain("Aujourd'hui");
    expect(text(html)).toContain("Promenade en groupe 60 min");
    expect(text(html)).toContain("walker.dogs 2 · Léa");
    expect(text(render({ visits: { "a-1": { ...walk, bookings: walk.bookings.slice(0, 1) } } }))).toContain("walker.dog · Léa");
    expect(text(html)).toContain("today.stats.title");
    expect(text(html)).toContain("today.now");
    expect(text(html)).toContain("Sofia Rossi"); // the next client
  });

  it("opens an appointment from the address: each row links to ?appointment=<id>", () => {
    expect(render({})).toContain('href="/fr/app/s-1/aujourdhui?appointment=a-1"');
  });

  it("announces the brief under the heading and keeps the invoices beside the agenda, which then takes two columns", () => {
    const html = render({ banner: <p data-testid="banner">the point</p>, aside: <section data-testid="aside">invoices</section> });
    expect(html.indexOf('data-testid="banner"')).toBeLessThan(html.indexOf("today.agendaLabel"));
    expect(html.indexOf("today.agendaLabel")).toBeLessThan(html.indexOf('data-testid="aside"'));
    expect(html).not.toContain('data-span="full" aria-labelledby');
  });

  it("shows the empty day with the beaver and no invoices widget when there are none", () => {
    const html = render({ appointments: [], visits: {}, aside: null });
    expect(text(html)).toContain("today.noneTitle");
    expect(text(html)).toContain("today.none ");
    expect(text(html)).not.toContain("today.statuses.booked");
  });
});
