import { KrizakaQueryProvider } from "@krizaka/query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n-client";
import type { TodayAppointment } from "@/lib/today";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { TodayDay, type TodayDayProps } from "./TodayDay";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, replace: () => undefined, push: () => undefined }), usePathname: () => "/en/app" }));

const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;
const readable = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");

const appointment = (id: string, hour: number, patch: Partial<TodayAppointment> = {}): TodayAppointment => ({
  id,
  startsAt: `2026-10-22T${hour + 4}:00:00.000Z`,
  endsAt: `2026-10-22T${hour + 4}:45:00.000Z`,
  staff: "Camille",
  service: { fr: "Coupe", en: "Haircut" },
  clientId: `c-${id}`,
  client: `Client ${id}`,
  status: "booked",
  checkedInAt: null,
  priceCents: 4_500,
  category: "standard",
  ...patch,
});

const day: TodayDayProps = {
  appointments: [appointment("a", 9, { status: "done" }), appointment("b", 11), appointment("c", 14, { client: null, clientId: null })],
  shop: { timezone: "America/Toronto", registrant: true },
  day: "2026-10-22",
  today: "2026-10-22",
  nowIso: "2026-10-22T14:30:00.000Z",
  selectedId: null,
};

const render = (props: Partial<TodayDayProps> = {}, locale: "en" | "fr" = "en") =>
  readable(
    renderToStaticMarkup(
      <I18nProvider locale={locale} messages={MESSAGES[locale] as never}>
        <KrizakaQueryProvider>
          <TodayDay {...day} {...props} />
        </KrizakaQueryProvider>
      </I18nProvider>,
    ),
  );

describe("the owner's day", () => {
  it("lists the appointments in time order with the « now » line between the past and the next", () => {
    const text = render();
    expect(text.indexOf("Client a")).toBeLessThan(text.indexOf("Now · 10:30"));
    expect(text.indexOf("Now · 10:30")).toBeLessThan(text.lastIndexOf("Client b"));
    expect(text.lastIndexOf("Client b")).toBeLessThan(text.lastIndexOf("Walk-in"));
  });

  it("draws no « now » line on another day, and says the day is free when nothing is booked", () => {
    expect(render({ day: "2026-10-23" })).not.toContain("Now ·");
    const free = render({ appointments: [], day: "2026-10-23" });
    expect(free).toContain("No appointment on this day.");
  });

  it("shows three figures: appointments, what the day bills with taxes, and the next client", () => {
    const text = render();
    expect(text).toContain("Appointments 3");
    expect(text).toContain("GST and QST included");
    // 3 × 45.00 = 135.00 plus 5 % and 9.975 %.
    expect(text).toContain("$155.22");
    expect(text).toMatch(/Next client Client b 11:00/);
  });

  it("offers Start on a booked visit, Finish once it began, and nothing on a done one", () => {
    const text = render({ appointments: [appointment("a", 9, { status: "done" }), appointment("b", 11, { checkedInAt: "2026-10-22T15:00:00.000Z" }), appointment("c", 14)] });
    expect(text.match(/Start/g)).toHaveLength(1);
    expect(text.match(/Finish/g)).toHaveLength(1);
    expect(text).toContain("In progress");
  });

  it("makes each row an address of its own, so the open appointment is in the URL", () => {
    const html = renderToStaticMarkup(
      <I18nProvider locale="en" messages={MESSAGES.en as never}>
        <KrizakaQueryProvider>
          <TodayDay {...day} />
        </KrizakaQueryProvider>
      </I18nProvider>,
    );
    expect(html).toContain('href="/en/app?appointment=b"');
  });

  it("speaks French with the French money", () => {
    const text = render({}, "fr");
    expect(text).toContain("Revenu attendu");
    expect(text).toMatch(/155,22\s?\$/);
  });
});
