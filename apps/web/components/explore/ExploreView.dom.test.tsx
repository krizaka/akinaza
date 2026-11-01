// @vitest-environment jsdom
import { type ExploreShop, rankByDistance } from "@akinaza/core";
import type { Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import enRaw from "@/messages/en.json";

import type { ExploreWords } from "./ExploreView";
import { bindProduct } from "@/lib/brand";

const en = bindProduct(enRaw);

vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="map-stub" /> }));
// The address is the browser's: the adapter of @krizaka/query/url reads and writes it through the history, as in the app.
vi.mock("next/navigation", () => ({ usePathname: () => "/explore", useRouter: () => ({ replace: () => undefined, push: () => undefined }), useSearchParams: () => new URLSearchParams(window.location.search) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const d = en.explore;
const words: ExploreWords = { search: d.search, filters: d.filters, list: { ...d.list, countOne: d.list.count_one }, view: d.view, map: d.map, empty: d.empty, error: d.error, loading: d.loading };
const shop = (slug: string, over: Partial<ExploreShop>): ExploreShop => ({ slug, name: slug.toUpperCase(), kind: "salon", area: null, taglineFr: null, taglineEn: null, quartiers: [], point: null, openNow: false, freeToday: false, ...over });
const SHOPS = [shop("far", { point: [-73.4, 45.6], openNow: true }), shop("near", { point: [-73.581, 45.481], kind: "boutique", freeToday: true })];

const getCurrentPosition = vi.fn((ok: (p: { coords: { longitude: number; latitude: number } }) => void) => ok({ coords: { longitude: -73.58, latitude: 45.48 } }));
// Each test loads a fresh copy of the page and of React, as a new visit would. (The adapter still carries what an earlier test wrote to the address into the next one that opens on an address: the tests that write come after those that read, in this file's order.)
let act: (cb: () => unknown) => Promise<void> | void = (cb) => void cb();
let createRoot: (el: HTMLElement) => Root = () => { throw new Error("mount first"); };
let ExploreView: typeof import("./ExploreView").ExploreView = () => <div />;
let root: Root | null = null;
let host: HTMLElement | null = null;
let requests: string[] = [];
beforeAll(() => {
  globalThis.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined })) as never;
  Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
});
afterEach(async () => {
  await act(() => root?.unmount());
  host?.remove();
  getCurrentPosition.mockClear();
  // The adapter flushes its queued address writes on a timer: let it finish before the next test sets its own address.
  await new Promise((r) => setTimeout(r, 200));
  window.history.replaceState(null, "", "/");
});

/** The endpoint's stand-in: the filters of the query string applied to SHOPS, nearest first from `near` (the real one is tested with its SQL). */
function answer(url: string) {
  const params = new URL(url, "http://x").searchParams;
  const kinds = params.get("kind")?.split(",");
  const near = params.get("near")?.split(",").map(Number);
  const kept = SHOPS.filter((s) => (!kinds || kinds.includes(s.kind)) && (params.get("open") !== "now" || s.openNow) && (params.get("open") !== "free-today" || s.freeToday));
  return { shops: rankByDistance(kept, near ? [near[0]!, near[1]!] : null), next: null };
}

async function fresh() {
  vi.resetModules();
  act = (await import("react")).act as never;
  createRoot = (await import("react-dom/client")).createRoot;
  ExploreView = (await import("./ExploreView")).ExploreView;
}

async function mount(opts: { address?: string; payload?: unknown; ok?: boolean; delayMs?: number } = {}) {
  requests = [];
  window.history.replaceState(null, "", opts.address ?? "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
  globalThis.fetch = vi.fn(async (input: unknown) => {
    const url = String(input instanceof Request ? input.url : input);
    requests.push(url.replace(/^https?:\/\/[^/]+/, ""));
    if (opts.delayMs && requests.length > 1) await new Promise((r) => setTimeout(r, opts.delayMs));
    if (opts.ok === false) return new Response("no", { status: 500 });
    return Response.json(opts.payload ?? answer(url));
  }) as never;
  await fresh();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(<ExploreView locale="en" words={words} />));
  await act(async () => new Promise((r) => setTimeout(r, 30)));
  return host;
}
const wait = (ms: number) => act(async () => new Promise((r) => setTimeout(r, ms)));
const names = () => [...host!.querySelectorAll("[data-testid=explore-list] li h2")].map((h) => h.textContent);
const button = (label: string) => [...host!.querySelectorAll("button")].find((b) => b.textContent === label)!;
const chips = () => [...host!.querySelectorAll("[data-testid=explore-filters] button[aria-label^='Remove']")].map((b) => b.getAttribute("aria-label"));
const search = () => new URLSearchParams(window.location.search);

describe("Explorer (the list on a phone, jsdom)", () => {
  it("lists the shops by name, asks for no position on load, and shows the map only after the toggle", async () => {
    const el = await mount();
    expect(names()).toEqual(["FAR", "NEAR"]);
    expect(requests).toEqual(["/api/explore/shops"]);
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(el.querySelector("[data-testid=map-stub]")).toBeNull();
    await act(async () => button("Map").click());
    expect(el.querySelector("[data-testid=map-stub]")).not.toBeNull();
  });

  it("opens on the filters of the address: one request for them, one chip each, the list they give", async () => {
    await mount({ address: "/?kind=boutique&open=free-today" });
    expect(requests).toEqual(["/api/explore/shops?kind=boutique&open=free-today"]);
    expect(chips()).toEqual(["Remove: Boutiques", "Remove: A free time today"]);
    expect(names()).toEqual(["NEAR"]);
  });

  it("says when nothing matches, with a way back (the way itself is « Clear all », next test)", async () => {
    await mount({ address: "/?kind=services" });
    expect(names()).toEqual([]);
    expect(host!.querySelector("[data-testid=explore-empty]")).not.toBeNull();
    expect(button("Clear the filters")).toBeTruthy();
  });

  it("takes a chip off the address and the request (the others stay), and « Clear all » empties both", async () => {
    await mount({ address: "/?kind=boutique,salon&open=now" });
    expect(chips()).toEqual(["Remove: Salons", "Remove: Boutiques", "Remove: Open now"]);
    await act(async () => (host!.querySelector("[aria-label='Remove: Salons']") as HTMLElement).click());
    await wait(150);
    expect(search().get("kind")).toBe("boutique");
    expect(requests.at(-1)).toBe("/api/explore/shops?kind=boutique&open=now");
    await act(async () => button("Clear all").click());
    await wait(150);
    expect(window.location.search).toBe("");
    expect(requests.at(-1)).toBe("/api/explore/shops");
    expect(chips()).toEqual([]);
    expect(names()).toEqual(["FAR", "NEAR"]);
  });

  it("waits for a pause in the typing: one request for the text, none per key; the address holds it", async () => {
    await mount();
    const input = host!.querySelector("input[type=search]:not([name=q])") as HTMLInputElement;
    const type = (value: string) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    await act(async () => type("co"));
    await act(async () => type("coi"));
    await act(async () => type("coif"));
    expect(requests).toEqual(["/api/explore/shops"]);
    await wait(400);
    expect(requests).toEqual(["/api/explore/shops", "/api/explore/shops?q=coif"]);
    expect(search().get("q")).toBe("coif");
    expect(chips()).toEqual(["Remove: “coif”"]);
  });

  it("keeps the previous list on screen, marked busy, while the next one loads", async () => {
    await mount({ delayMs: 300 });
    await act(async () => button("Near me").click());
    await wait(80);
    const list = host!.querySelector("[data-testid=explore-list]")!;
    expect(list.getAttribute("aria-busy")).toBe("true");
    expect(names()).toEqual(["FAR", "NEAR"]);
    await wait(500);
    expect(list.getAttribute("aria-busy")).toBe("false");
    expect(names()).toEqual(["NEAR", "FAR"]);
  });

  it("ranks by distance after « Near me » (a click) with the position in the address, and goes back to the name's order", async () => {
    await mount();
    await act(async () => button("Near me").click());
    await wait(150);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(search().get("near")).toBe("-73.58,45.48");
    expect(names()).toEqual(["NEAR", "FAR"]);
    expect(host!.textContent).toContain("away");
    expect(chips()).toContain("Remove: Around you");
    await act(async () => button("Show all shops").click());
    await wait(150);
    expect(search().has("near")).toBe(false);
    expect(names()).toEqual(["FAR", "NEAR"]);
  });

  it("says when the shops could not be loaded, with a retry", async () => {
    await mount({ ok: false });
    expect(host!.textContent).toContain("The shops could not be loaded.");
    expect(button("Try again")).toBeTruthy();
  });

  it("renders the same first markup on the server and in the browser: « Near me » appears only after hydration (React #418)", async () => {
    // The server has no navigator.geolocation; the browser has. A markup that reads it while rendering differs, and React reports #418.
    expect(renderToString(<ExploreView locale="en" words={words} />)).not.toContain(">Near me</button>");
    await mount();
    expect(button("Near me")).toBeTruthy();
  });
});
