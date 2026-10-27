import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const APP = join(__dirname, "../app/[locale]/(app)/app");
const read = (p: string) => readFileSync(p, "utf8");
const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));

/** The groups of the signed-in space, each with a layout that draws the frame: the account (a client, or no shop in use) and a shop. */
const FRAMED = ["(account)", "[shop]"];

describe("every signed-in page sits in the shared AppFrame (akinaza#431, #440: the same shell as Yomizaka)", () => {
  it("has a page only inside a group whose layout wraps it in SpaceChrome (the ShopFrame of @krizaka/ui's AppFrame)", () => {
    const pages = walk(APP).filter((f) => /\/(page|route)\.tsx?$/.test(f) && /page\.tsx$/.test(f));
    expect(pages.length).toBeGreaterThan(10);
    for (const page of pages) {
      const group = relative(APP, page).split("/")[0]!;
      expect(FRAMED, `${relative(APP, page)} is outside the framed groups`).toContain(group);
    }
    for (const group of FRAMED) expect(read(join(APP, group, "layout.tsx")), group).toContain("<SpaceChrome");
  });

  it("the legacy addresses are redirects only, never a page of their own", () => {
    const legacy = walk(join(APP, "(legacy)")).map((f) => f.split("/").pop());
    expect(new Set(legacy)).toEqual(new Set(["route.ts"]));
  });

  it("SpaceChrome gives a client the same frame as an owner: ShopFrame, which is the shared AppFrame with its account menu and labelled rail", () => {
    const chrome = read(join(__dirname, "../components/app/SpaceChrome.tsx"));
    expect(chrome.match(/<ShopFrame/g)!.length).toBeGreaterThanOrEqual(2);
    const frame = read(join(__dirname, "../components/app/ShopFrame.tsx"));
    expect(frame).toContain('from "@krizaka/ui/app-frame"');
    expect(frame).not.toMatch(/RailNav|AccountMenu|AppHeader/);
  });

  it("the booking confirmation, the only other signed-in page, is framed too when it shows a client's own space", () => {
    expect(read(join(__dirname, "../app/[locale]/s/[slug]/service/[id]/confirm/page.tsx"))).toContain("<SpaceChrome");
  });
});
