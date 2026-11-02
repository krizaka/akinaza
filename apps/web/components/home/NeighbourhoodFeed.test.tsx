import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { bindProduct } from "@/lib/brand";
import type { FeedView } from "@/lib/feed-view";
import enRaw from "@/messages/en.json";
import frRaw from "@/messages/fr.json";

import { NeighbourhoodFeed } from "./NeighbourhoodFeed";

const en = bindProduct(enRaw);
const fr = bindProduct(frRaw);

const view: FeedView = {
  flyers: [
    { id: "a", text: "Open day on Saturday", until: "Until October 31", shop: { name: "Atelier", href: "/en/s/atelier" } },
    { id: "b", text: "A walk left on Tuesdays", until: null, shop: { name: "Pattes", href: "/en/s/pattes" } },
  ],
  quartiers: ["Saint-Henri", "Villeray"],
  quartier: null,
};
const html = (words: typeof en.landing.feed, locale = "en") => renderToStaticMarkup(<NeighbourhoodFeed initial={view} locale={locale} words={words} />);

describe("the home's neighbourhood feed (#318)", () => {
  it("draws the flyers on the board, each leading to its shop, with a chip per neighbourhood", () => {
    const out = html(en.landing.feed);
    expect(out).toContain("Open day on Saturday");
    expect(out).toContain('href="/en/s/atelier"');
    expect(out).toContain("See Atelier");
    expect(out).toContain("data-bulletin");
    for (const chip of [en.landing.feed.all, "Saint-Henri", "Villeray"]) expect(out).toContain(chip);
  });

  it("starts on all neighbourhoods", () => {
    expect(html(en.landing.feed)).toMatch(/aria-pressed="true"[^>]*>All neighbourhoods/);
  });

  it("speaks French from the catalogue", () => {
    const out = html(fr.landing.feed as never, "fr");
    expect(out).toContain("Voir Atelier");
    expect(out).toContain("Tous les quartiers");
  });

  it("has the same words in both languages", () => {
    expect(Object.keys(fr.landing.feed)).toEqual(Object.keys(en.landing.feed));
  });
});
