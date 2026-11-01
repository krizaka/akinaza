import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { bindProduct } from "@/lib/brand";
import type { FeedOverview } from "@/lib/feed-overview";
import enRaw from "@/messages/en.json";
import frRaw from "@/messages/fr.json";

import { FeedLinks } from "./FeedLinks";

const en = bindProduct(enRaw);
const fr = bindProduct(frRaw);

const say = (key: string, vars?: Record<string, string | number>) => {
  const value = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], en.console) as string;
  return vars ? Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), value) : value;
};
vi.mock("@/lib/i18n-client", () => ({ useSay: () => ({ say, locale: "en" }) }));
vi.mock("@/components/app/useCall", () => ({ useCall: () => ({ run: vi.fn(), pending: false, problem: null }) }));

const text = (h: string) => h.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
const overview = (over: Partial<FeedOverview> = {}): FeedOverview => ({
  enabled: true,
  shop: { live: true, createdAt: "2026-10-26T12:00:00Z", rotatedAt: null },
  people: [{ id: "p1", name: "Julie", live: false, createdAt: null, rotatedAt: null }],
  ...over,
});

describe("the calendar links screen (#282)", () => {
  it("shows each feed's state, makes or renews the link and turns it off, with how to add it", () => {
    const t = text(renderToStaticMarkup(<FeedLinks overview={overview()} shopName="Salon Laurier" />));
    for (const word of ["The whole shop · Salon Laurier", "Link active", "Make a new link", "Turn off", "Julie", "No link yet", "Make the link", "How to add it", "Google Calendar"]) expect(t).toContain(word);
  });

  it("never draws an address or a QR code: they exist only in the answer that made it", () => {
    expect(renderToStaticMarkup(<FeedLinks overview={overview()} shopName="S" />)).not.toMatch(/kf1\.|\/api\/feed\/|readOnly|<svg[^>]*role="img"/);
  });

  it("says so, and offers nothing, when the administrator switched the links off", () => {
    const t = text(renderToStaticMarkup(<FeedLinks overview={overview({ enabled: false, shop: null, people: [] })} shopName="S" />));
    expect(t).toContain("switched the calendar links off");
    expect(t).not.toContain("Make the link");
  });

  it("a member who opens only their own sees no shop row", () => {
    const t = text(renderToStaticMarkup(<FeedLinks overview={overview({ shop: null })} shopName="S" />));
    expect(t).not.toContain("The whole shop");
    expect(t).toContain("Julie");
  });

  it("has the same words in French", () => {
    expect(Object.keys(fr.console.boutique.agenda.feed)).toEqual(Object.keys(en.console.boutique.agenda.feed));
  });
});
