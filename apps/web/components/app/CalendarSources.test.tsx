import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { CalendarOverview } from "@/lib/calendar/overview";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { CalendarSources } from "./CalendarSources";

const say = (key: string, vars?: Record<string, string | number>) => {
  const value = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], en.console) as string;
  return vars ? Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), value) : value;
};
vi.mock("@/lib/i18n-client", () => ({ useSay: () => ({ say, locale: "en" }) }));
vi.mock("@/components/app/useCall", () => ({ useCall: () => ({ run: vi.fn(), pending: false, problem: null }) }));

const text = (h: string) => h.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
const overview = (over: Partial<CalendarOverview> = {}): CalendarOverview => ({
  enabled: true,
  kinds: ["ics"],
  people: [{ id: "p1", name: "Julie" }],
  wholeShop: true,
  connections: [{ id: "c1", staffId: null, kind: "ics", label: "Google", state: "ok", lastError: null, lastSuccessAt: "2026-10-26T12:00:00Z", consentedAt: "2026-10-26T11:00:00Z" }],
  ...over,
});

describe("the other calendars screen (#282, ADR-004)", () => {
  it("lists each calendar with its state, offers to read it again or disconnect, and asks for the consent to connect another", () => {
    const t = text(renderToStaticMarkup(<CalendarSources overview={overview()} />));
    for (const word of ["Your other calendars", "Google", "Read", "Read again", "Disconnect", "Connect a calendar", "I agree that Akinaza reads the times I am busy", "never a title"]) expect(t).toContain(word);
  });

  it("shows why a calendar cannot be read, in words", () => {
    const t = text(renderToStaticMarkup(<CalendarSources overview={overview({ connections: [{ id: "c1", staffId: "p1", kind: "ics", label: "Work", state: "error", lastError: "AK_CAL_REFUSED", lastSuccessAt: null, consentedAt: "2026-10-26T11:00:00Z" }] })} />));
    expect(t).toContain("Cannot read");
    expect(t).toContain("The calendar refused us");
    expect(t).toContain("Not read yet.");
    expect(t).toContain("Julie");
  });

  it("never draws an address: it is sealed on the server", () => {
    expect(renderToStaticMarkup(<CalendarSources overview={overview()} />)).not.toMatch(/https?:\/\/|webcal:/);
  });

  it("says so, and offers nothing, when the administrator switched calendars off", () => {
    const t = text(renderToStaticMarkup(<CalendarSources overview={overview({ enabled: false, kinds: [], connections: [] })} />));
    expect(t).toContain("switched calendar connections off");
    expect(t).not.toContain("Connect a calendar");
  });

  it("is written in both languages, with the same placeholders", () => {
    const keys = (o: unknown, p = ""): string[] => (typeof o === "object" && o ? Object.entries(o).flatMap(([k, v]) => keys(v, `${p}${k}.`)) : [p]);
    expect(keys(fr.console.boutique.agenda.sources)).toEqual(keys(en.console.boutique.agenda.sources));
  });

  it("offers Google and Outlook only when the administrator switched them on, with the consent and what is read", () => {
    const t = text(renderToStaticMarkup(<CalendarSources overview={overview({ kinds: ["ics", "google", "outlook"] })} />));
    for (const word of ["Connect Google Calendar", "Connect Outlook", "never a title, a guest or a note"]) expect(t).toContain(word);
    expect(text(renderToStaticMarkup(<CalendarSources overview={overview({ kinds: ["ics"] })} />))).not.toContain("Connect Google Calendar");
  });

  it("works with the providers alone, without the ICS address form", () => {
    const t = text(renderToStaticMarkup(<CalendarSources overview={overview({ kinds: ["google"] })} />));
    expect(t).toContain("Connect Google Calendar");
    expect(t).not.toContain("Calendar address (ICS)");
  });

  it("says the same words in French", () => {
    for (const loc of [en, fr]) expect(Object.keys(loc.console.boutique.agenda.sources.providers)).toEqual(["title", "lead", "google", "outlook"]);
  });
});
