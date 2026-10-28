import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { FlyerView } from "@/lib/community-view";

import { Bulletin, flyerLook } from "./Bulletin";

const flyers: FlyerView[] = ["a", "b", "c", "d", "e", "f"].map((id) => ({
  id,
  text: `Flyer ${id} ${"long ".repeat(60)}`.trim(),
  until: id === "a" ? "Until October 31" : null,
  shop: { name: `Shop ${id}`, href: `/en/s/${id}` },
}));

describe("the neighbourhood board as post-its (#504)", () => {
  it("gives every flyer a look read from its id: the same each time, within the board's papers, a gentle lean", () => {
    for (const f of flyers) {
      expect(flyerLook(f.id)).toEqual(flyerLook(f.id));
      expect(Math.abs(flyerLook(f.id).tilt)).toBeLessThanOrEqual(2);
    }
    const looks = new Set(flyers.map((f) => JSON.stringify(flyerLook(f.id))));
    expect(looks.size).toBeGreaterThan(2);
  });

  it("draws a post-it per flyer, held by tape or a pin, with the whole text and a link to the shop", () => {
    const out = renderToStaticMarkup(
      <Bulletin
        flyers={flyers.slice(0, 3)}
        label="Board"
        visit={(s) => `See ${s}`}
      />,
    );
    expect(out.match(/data-postit/g)).toHaveLength(3);
    expect(out).toMatch(/data-hold="(pin|tape)"/);
    expect(out).toContain(flyers[0].text);
    for (const id of ["a", "b", "c"])
      expect(out).toContain(`href="/en/s/${id}"`);
    expect(out).toContain("See Shop a");
    expect(out).not.toContain("bg-surface-1");
  });

  it("uses no literal colour: the papers are the page's tokens", () => {
    const out = renderToStaticMarkup(
      <Bulletin flyers={flyers.slice(0, 3)} label="Board" />,
    );
    expect(out).not.toMatch(/#[0-9a-f]{3,6}\b|zinc|rgb\(/i);
  });
});
