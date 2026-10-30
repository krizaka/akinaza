// @vitest-environment jsdom
import type { ExploreShop } from "@akinaza/core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";

import { ExploreView, type ExploreWords } from "./ExploreView";

vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="map-stub" /> }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const d = en.explore;
const words: ExploreWords = { search: d.search, filters: d.filters, list: { ...d.list, countOne: d.list.count_one }, view: d.view, map: d.map, empty: d.empty, error: d.error, loading: d.loading };
const shop = (slug: string, over: Partial<ExploreShop>): ExploreShop => ({ slug, name: slug.toUpperCase(), kind: "salon", area: null, taglineFr: null, taglineEn: null, quartiers: [], point: null, openNow: false, freeToday: false, ...over });
const SHOPS = [shop("far", { point: [-73.4, 45.6], openNow: true }), shop("near", { point: [-73.581, 45.481], kind: "boutique", freeToday: true })];

const getCurrentPosition = vi.fn((ok: (p: { coords: { longitude: number; latitude: number } }) => void) => ok({ coords: { longitude: -73.58, latitude: 45.48 } }));
let root: Root | null = null;
let host: HTMLElement | null = null;
beforeAll(() => {
  globalThis.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined })) as never;
  Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  getCurrentPosition.mockClear();
});

async function mount(payload: unknown, ok = true) {
  globalThis.fetch = vi.fn(async () => (ok ? Response.json(payload) : new Response("no", { status: 500 }))) as never;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(<ExploreView locale="en" words={words} />));
  await act(async () => new Promise((r) => setTimeout(r, 20)));
  return host;
}
const names = () => [...host!.querySelectorAll("[data-testid=explore-list] li h2")].map((h) => h.textContent);
const button = (label: string) => [...host!.querySelectorAll("button")].find((b) => b.textContent === label)!;

describe("Explorer (the list on a phone, jsdom)", () => {
  it("lists the shops by name, asks for no position on load, and shows the map only after the toggle", async () => {
    const el = await mount({ shops: SHOPS });
    expect(names()).toEqual(["FAR", "NEAR"]);
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(el.querySelector("[data-testid=map-stub]")).toBeNull();
    await act(async () => button("Map").click());
    expect(el.querySelector("[data-testid=map-stub]")).not.toBeNull();
  });

  it("filters by kind, open now and a free time today, and says so when nothing matches (with a way back)", async () => {
    await mount({ shops: SHOPS });
    await act(async () => button("Boutiques").click());
    expect(names()).toEqual(["NEAR"]);
    await act(async () => button("Open now").click());
    expect(names()).toEqual([]);
    expect(host!.querySelector("[data-testid=explore-empty]")).not.toBeNull();
    await act(async () => button("Clear the filters").click());
    expect(names()).toEqual(["FAR", "NEAR"]);
  });

  it("ranks by distance after « Near me » (a click), with the distance said, and goes back to the name's order", async () => {
    await mount({ shops: SHOPS });
    await act(async () => button("Near me").click());
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(names()).toEqual(["NEAR", "FAR"]);
    expect(host!.textContent).toContain("away");
    await act(async () => button("Show all shops").click());
    expect(names()).toEqual(["FAR", "NEAR"]);
  });

  it("says when the shops could not be loaded, with a retry", async () => {
    await mount({}, false);
    expect(host!.textContent).toContain("The shops could not be loaded.");
    expect(button("Try again")).toBeTruthy();
  });

  it("renders the same first markup on the server and in the browser: « Near me » appears only after hydration (React #418)", async () => {
    // The server has no navigator.geolocation; the browser has. A markup that reads it while rendering differs, and React reports #418.
    expect(renderToString(<ExploreView locale="en" words={words} />)).not.toContain("Near me");
    await mount({ shops: SHOPS });
    expect(button("Near me")).toBeTruthy();
  });
});
