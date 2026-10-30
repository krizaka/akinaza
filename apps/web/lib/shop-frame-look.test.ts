import { shopPresets } from "@krizaka/tokens/shop-presets";
import { describe, expect, it } from "vitest";

import { shopFrameLook } from "./shop-frame-look";

const looks = shopPresets.filter((p) => p.id.startsWith("look-"));

describe("the frame of a shop page wears its whole look", () => {
  it("every look's own motion and rhythm reach the frame when the document sets none (they were dropped before)", () => {
    expect(looks.length).toBeGreaterThan(0);
    for (const look of looks) {
      expect(shopFrameLook({ preset: { id: look.id } }), look.id).toEqual({ preset: look.id, density: look.density, motion: look.motion });
    }
  });

  it("the document's density wins over the look's", () => {
    const airy = looks.find((l) => l.density === "airy")!;
    expect(shopFrameLook({ preset: { id: airy.id }, density: "compact" }).density).toBe("compact");
  });

  it("the owner's accent is worn only when the shown look lists it: an accent chosen on another look falls back to the look's own", () => {
    const look = looks[0]!;
    const listed = look.accents[1] ?? look.accents[0]!;
    expect(shopFrameLook({ preset: { id: look.id } }, listed).accent).toBe(listed);
    const foreign = shopPresets.flatMap((p) => p.accents).find((a) => !look.accents.includes(a));
    expect(foreign, "some accent is not in this look's list").toBeTruthy();
    expect(shopFrameLook({ preset: { id: look.id } }, foreign).accent).toBeUndefined();
    expect(shopFrameLook({ preset: { id: look.id } }, null).accent).toBeUndefined();
  });

  it("a trade preset (no motion of its own) keeps the frame still by default, and an unknown preset only names itself", () => {
    const trade = shopPresets.find((p) => !p.id.startsWith("look-"))!;
    expect(shopFrameLook({ preset: { id: trade.id } }).motion).toBeUndefined();
    expect(shopFrameLook({ preset: { id: "nope-nope" } })).toEqual({ preset: "nope-nope" });
  });
});
