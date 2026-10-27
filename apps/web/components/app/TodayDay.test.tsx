import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { shopRoutes } from "@/lib/routes";

import { billAppointmentHref, TodayDay, type TodayDayProps } from "./TodayDay";
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
  appointments: [{ id: "a-1", startsAt: walk.startsAt, endsAt: walk.endsAt, staff: "Léa", service: { fr: walk.service.fr, en: walk.service.en }, serviceId: "s-walk", clientId: "c-1", client: "Sofia Rossi", status: "booked", checkedInAt: null, priceCents: 3_500, category: "standard" }],
  shop: { timezone: "America/Toronto", registrant: true },
  day: "2026-10-23",
  today: "2026-10-23",
  nowIso: "2026-10-23T17:30:00.000Z",
  selectedId: null,
  allow: { clients: true, revenue: true },
  title: "Aujourd'hui",
  description: "vendredi 23 octobre 2026",
  visits: { "a-1": walk },
  dependants: true,
  board: null,
  period: 7,
};
const render = (props: Partial<TodayDayProps>) => renderToStaticMarkup(<TodayDay {...base} {...props} />);
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

const board: NonNullable<TodayDayProps["board"]> = {
  week: 11,
  toBill: [{ appointmentId: "a-9", clientId: "c-9", client: "Studio Lumen inc.", serviceId: "s-walk", startsAt: "2026-10-22T14:00:00.000Z" }],
  activity: { days: ["2026-10-21", "2026-10-22", "2026-10-23"], invoicedCents: [0, 5_174, 10_000], collectedCents: [0, 2_000, 0], appointments: [1, 2, 0] },
  balance: { owedCents: 3_174, overdueCents: 3_174, count: 1, overdueCount: 1 },
  chase: { id: "i-4", number: "KZ-00004", client: "Studio Lumen inc.", dueOn: "2026-10-19", remainingCents: 3_174, overdue: true },
};

describe("Aujourd'hui on the home grammar (D4): the headline, the date on the right, the binder, two columns", () => {
  it("makes the headline the page's one h1, true to the day (the pets shop reads its walk)", () => {
    const html = render({ board });
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/g) ?? [];
    expect(h1).toHaveLength(1);
    expect(text(h1[0]!)).toContain("today.headline.nextService Promenade en groupe 60 min");
    expect(text(render({ board, dependants: false }).match(/<h1[^>]*>[\s\S]*?<\/h1>/)![0])).toContain("today.headline.next Sofia Rossi");
  });

  it("puts the date on the right with the previous and next day, and draws no strip of days", () => {
    const html = render({ board });
    expect(html).not.toContain("today.dayStrip");
    expect(html).toContain('href="/fr/app/s-1/aujourdhui?day=2026-10-22"');
    expect(html).toContain('href="/fr/app/s-1/aujourdhui?day=2026-10-24"');
    expect(text(html)).toMatch(/today\.week 43/);
  });

  it("opens « Le classeur » under the heading: Rendez-vous · À facturer · À encaisser · Cette semaine, with their counts", () => {
    const t = text(render({ board }));
    for (const part of ["today.glance.appointments 1", "today.glance.toBill 1", "today.glance.toCollect 1", "today.glance.week 11"]) expect(t).toContain(part);
    expect(t.indexOf("today.glance.title")).toBeLessThan(t.indexOf("today.agendaLabel"));
  });

  it("never lets a cents value reach a label: money is an amount in dollars, the period is named in each label", () => {
    const html = render({ board });
    const t = text(html);
    expect(t).toContain("151,74");
    for (const cents of ["15174", "15 174", "15,174", "5174", "5 174", "5,174", "3174", "3,174"]) expect(t).not.toContain(cents);
    expect(t).toContain("today.activity.daysLong 7");
  });

  it("holds quick access, the activity and « À encaisser » in the side column, after the agenda", () => {
    const html = render({ board, publicPageHref: "/fr/s/demo" });
    const t = text(html);
    expect(t.indexOf("today.agendaLabel")).toBeLessThan(t.indexOf("today.quick.title"));
    expect(html).toContain('href="/fr/app/s-1/invoices/new?client=c-9&amp;service=s-walk&amp;quantity=1&amp;appointment=a-9"');
    expect(html).toContain('href="/fr/app/s-1/invoices/i-4"');
    expect(html).toContain('href="/fr/s/demo"');
    for (const part of ["today.activity.invoiced", "today.activity.collected", "today.activity.appointments"]) expect(t).toContain(part);
    expect(html).toContain("today.balance.overdue");
  });

  it("writes the activity charts' text version as money, not as cents (« 10 000 » for 100 $)", () => {
    const html = render({ board });
    expect(html).toMatch(/Invoiced|today\.activity\.invoiced/);
    expect(html).not.toMatch(/10[\s\u202f\u00a0,]?000[^0-9]/);
    expect(html).toMatch(/100[.,]00/);
  });

  it("keeps the period in the address: 7, 30 or 90 days, the current one marked", () => {
    const html = render({ board, period: 30 });
    for (const p of [30, 90]) expect(html).toContain(`href="/fr/app/s-1/aujourdhui?period=${p}"`);
    expect(html).toContain('href="/fr/app/s-1/aujourdhui"'); // 7 days, the default: no parameter
    expect(html).toMatch(/aria-current="page"[^>]*href="\/fr\/app\/s-1\/aujourdhui\?period=30"|href="\/fr\/app\/s-1\/aujourdhui\?period=30"[^>]*aria-current="page"/);
  });

  it("says nothing is late with the beaver when the balance has no overdue invoice", () => {
    const calm = { ...board, balance: { owedCents: 1_000, overdueCents: 0, count: 1, overdueCount: 0 }, chase: null };
    expect(text(render({ board: calm }))).toContain("today.balance.noneLate");
  });

  it("shows an all-zero day as its empty state, not a row of zeros", () => {
    const zero = { week: 0, toBill: [], activity: { days: ["2026-10-23"], invoicedCents: [0], collectedCents: [0], appointments: [0] }, balance: { owedCents: 0, overdueCents: 0, count: 0, overdueCount: 0 }, chase: null };
    const html = render({ appointments: [], visits: {}, board: zero });
    const t = text(html);
    expect(t).toContain("today.noneTitle");
    expect(t).not.toContain("today.activity.invoiced");
    expect(t).not.toContain("today.glance.title");
  });

  it("opens an appointment from the address: each row links to ?appointment=<id>", () => {
    expect(render({ board })).toContain('href="/fr/app/s-1/aujourdhui?appointment=a-1"');
  });

  it("shows no money to who may not see it: no activity, no balance", () => {
    const t = text(render({ board: null }));
    expect(t).not.toContain("today.activity.title");
    expect(t).not.toContain("today.balance.title");
  });
});

describe("the day's one primary (D1b): the next appointment, else a new invoice", () => {
  const primaries = (html: string) => html.match(/<a[^>]*data-primary[^>]*>[\s\S]*?<\/a>/g) ?? [];

  it("opens the next appointment, named by its client and its time", () => {
    const [primary, ...others] = primaries(render({ newInvoiceHref: "/fr/app/s-1/invoices/new" }));
    expect(others).toEqual([]);
    expect(primary).toContain('href="/fr/app/s-1/aujourdhui?appointment=a-1"');
    expect(text(primary!)).toContain("today.nextPrimary Sofia Rossi");
  });

  it("offers « Nouvelle facture » when nobody comes next, to who may issue invoices, and nothing to who may not", () => {
    const done = { ...base.appointments[0]!, status: "done" as const };
    const [primary, ...others] = primaries(render({ appointments: [done], newInvoiceHref: "/fr/app/s-1/invoices/new" }));
    expect(others).toEqual([]);
    expect(primary).toContain('href="/fr/app/s-1/invoices/new"');
    expect(primaries(render({ appointments: [], newInvoiceHref: null }))).toEqual([]);
  });
});

describe("a finished appointment is billed from its sheet (D3)", () => {
  const routes = shopRoutes("fr", "s-1");
  it("offers « Facturer ce rendez-vous », prefilled with the client, the service and one unit, to who may invoice", () => {
    const done = { ...base.appointments[0]!, status: "done" as const };
    expect(billAppointmentHref(done, routes, true)).toBe("/fr/app/s-1/invoices/new?client=c-1&service=s-walk&quantity=1&appointment=a-1");
    expect(billAppointmentHref({ ...done, clientId: null }, routes, true)).toBe("/fr/app/s-1/invoices/new?service=s-walk&quantity=1&appointment=a-1");
    expect(billAppointmentHref(done, routes, false)).toBeNull();
    expect(billAppointmentHref(base.appointments[0]!, routes, true)).toBeNull();
  });
});

describe("a failing section of the day (D6): an alert in place, the rest renders", () => {
  it("says the side column could not load, with « Réessayer », and keeps the agenda", () => {
    const t = text(render({ board: null, boardFailed: true }));
    expect(t).toContain("states.error.title");
    expect(t).toContain("states.retry");
    expect(t).toContain("today.agendaLabel");
  });

  it("moves nothing on the page's arrival (D11): no row washes, no control rings, until an action succeeds", () => {
    const html = render({});
    expect(html).toContain("Sofia Rossi");
    expect(html).not.toContain("data-kz-arrive=");
    expect(html).not.toContain("data-kz-status=");
  });

  it("flags an appointment that overlaps the owner's other calendar, and keeps it (ADR-004)", () => {
    const html = render({ appointments: [{ ...base.appointments[0]!, agendaConflict: "Google" }] });
    expect(text(html)).toContain("today.conflict Google");
    expect(html).toContain("Sofia Rossi");
    expect(text(render({}))).not.toContain("today.conflict");
  });
});
