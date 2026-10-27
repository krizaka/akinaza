import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { bulletinLayout } from "@/components/shop/Bulletin";

import en from "../messages/en.json";
import fr from "../messages/fr.json";
import { SCREENS } from "./landing";

const home = readFileSync(new URL("../app/[locale]/page.tsx", import.meta.url), "utf8");

describe("the home after the pages review (akinaza#440)", () => {
  it("labels the hero's phone with the real address of the site, not the development host", () => {
    for (const t of [en, fr]) {
      expect(t.landing.visualLabel).toBe("www.akinaza.com");
      expect(t.landing.visualLabel).not.toMatch(/^dev\./);
    }
  });

  it("says what Akinaza is not for under the hero's actions, at a readable size, and not in the quiet footnote", () => {
    const actions = home.slice(home.indexOf("actions={"), home.indexOf("features={"));
    expect(actions).toContain("d.trust.scope");
    expect(actions).toMatch(/text-base text-fg-secondary/);
    const trust = home.slice(home.indexOf('id="trust"'));
    expect(trust).not.toContain("d.trust.scope");
  });

  it("gives the neighbourhood section one action of its own: the demo shop", () => {
    const feed = home.slice(home.indexOf('id="neighbourhood"'), home.indexOf('id="trust"'));
    expect(feed).toContain("DEMO_SHOP");
    expect(feed).toContain("d.feed.demo");
    expect(en.landing.feed.demo).toBeTruthy();
    expect(fr.landing.feed.demo).toBeTruthy();
  });
});

describe("the three cards show their screen's content, not an empty band (akinaza#440)", () => {
  it("starts the booking's card under the capture's empty band, and the others at the top", () => {
    expect(SCREENS.map((s) => [s.id, s.crop])).toEqual([
      ["book", "object-[50%_36%]"],
      ["invoice", "object-top"],
      ["books", "object-top"],
    ]);
    expect(home).toContain("object-cover\", crop)");
  });
});

describe("the bulletin board never ends on an orphan", () => {
  it.each([
    [1, 1, 3],
    [2, 2, 2],
    [3, 3, 3],
    [4, 4, 2],
    [5, 3, 3],
    [6, 6, 3],
    [7, 6, 3],
    [8, 6, 3],
    [9, 9, 3],
  ])("%i flyers: %i shown in %i columns", (count, shown, columns) => {
    expect(bulletinLayout(count)).toEqual({ shown, columns });
    expect(shown % columns === 0 || shown < columns).toBe(true);
  });
});
