import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The apps open the web's own addresses (D9, a class of bug): the Mac menu's ⌘5 still sent `/fr/app/<shop>/shop`, the address
 * « Ma page boutique » had before K4, kept only as a permanent redirect — the rail's Boutique is `/boutique`. The Mac's sections
 * (`apps/desktop/src-tauri/src/sections.rs`) are read here and each address must be a live page of the web: in a shop, a segment
 * under `app/[shop]/` that is not a moved address (`permanentRedirect`); without one, an old short address that is a route handler (a 307) under `(legacy)`.
 */
const REPO = fileURLToPath(new URL("../../..", import.meta.url));
const APP = join(REPO, "apps/web/app/[locale]/(app)/app");
const SECTIONS_RS = join(REPO, "apps/desktop/src-tauri/src/sections.rs");

/** `("section.today", "aujourdhui", "")` rows of the Rust table: the menu id, the shop page's segment, the short address's segment. */
export function desktopSections(source: string): { id: string; inShop: string; short: string }[] {
  const table = source.slice(source.indexOf("pub const SECTIONS"), source.indexOf("];", source.indexOf("pub const SECTIONS")));
  return [...table.matchAll(/\("([^"]+)",\s*"([^"]*)",\s*"([^"]*)"\)/g)].map((m) => ({ id: m[1]!, inShop: m[2]!, short: m[3]! }));
}

const page = (dir: string) => existsSync(join(dir, "page.tsx"));
const handler = (dir: string) => existsSync(join(dir, "route.ts"));
/** A page that is not only the trace of a moved address. */
const live = (dir: string) => page(dir) && !/permanentRedirect\(/.test(readFileSync(join(dir, "page.tsx"), "utf8"));

describe("the apps open the web's own addresses (D9)", () => {
  it("reads the Mac's five sections", () => {
    expect(desktopSections(readFileSync(SECTIONS_RS, "utf8")).map((s) => s.id)).toEqual(["section.today", "section.clients", "section.invoices", "section.books", "section.shop"]);
  });

  it.each(desktopSections(readFileSync(SECTIONS_RS, "utf8")))("$id: a page of the web in a shop and without one", ({ inShop, short }) => {
    expect(live(join(APP, "[shop]", inShop)), `/fr/app/<shop>/${inShop}`).toBe(true);
    expect(short === "" ? page(join(APP, "(account)")) : handler(join(APP, "(legacy)", short)), `/fr/app/${short}`).toBe(true);
  });

  it("refuses an address the web does not have, and one it keeps only to redirect", () => {
    const [moved, missing] = desktopSections('pub const SECTIONS: [(&str, &str, &str); 2] = [("section.shop", "shop", "shop"), ("section.x", "nowhere", "nowhere")];');
    expect(live(join(APP, "[shop]", moved!.inShop))).toBe(false);
    expect(live(join(APP, "[shop]", missing!.inShop))).toBe(false);
    expect(handler(join(APP, "(legacy)", missing!.short))).toBe(false);
  });
});
