import { castOf, defaultFor, listDefaults } from "@krizaka/org";
import { describe, expect, it } from "vitest";

import { avatarChoice, avatarOf, avatarOptions, avatarSrc, pictureOf } from "./avatar";

describe("a person without a photo wears the org JSON's default picture (akinaza#499)", () => {
  it("draws the picture the person chose", () => {
    const [first] = listDefaults("person");
    expect(pictureOf({ id: "a", avatarSeed: first!.id })?.id).toBe(first!.id);
    expect(avatarChoice({ avatarSeed: first!.id })).toBe(first!.id);
  });

  it("reads the old tones as the set's silhouettes", () => {
    expect(pictureOf({ id: "a", avatarSeed: "4" })?.id).toBe("silhouette-4");
    expect(avatarChoice({ avatarSeed: "4" })).toBe("silhouette-4");
  });

  it.each([null, undefined, "", "9", "x", "gone-from-the-set"])("assigns one from the id when the seed is %j, and the picker checks none", (seed) => {
    expect(pictureOf({ id: "a-1", avatarSeed: seed })?.id).toBe(defaultFor("person", "a-1")?.id);
    expect(avatarChoice({ avatarSeed: seed })).toBe("");
  });

  it("is deterministic per id, and the address is the org's Bunny one, not a copy", () => {
    const a = avatarSrc({ id: "eric" });
    expect(a).toBe(avatarSrc({ id: "eric" }));
    expect(a).toMatch(/^https:\/\/krizaka-assets\.b-cdn\.net\/defaults\/v\d+\/person\/.+-256\.webp$/);
    expect(avatarOf({ id: "eric" })).toEqual({ fallbackSrc: a });
  });

  it("gives different people different pictures across a team", () => {
    const ids = Array.from({ length: 24 }, (_, i) => pictureOf({ id: `person-${i}` })?.id);
    expect(new Set(ids).size).toBeGreaterThan(4);
  });

  it("offers the whole person set in the picker, labelled in each language", () => {
    const en = avatarOptions("en");
    expect(en).toHaveLength(listDefaults("person").length);
    expect(avatarOptions("fr")[0]!.label).not.toBe(en[0]!.label);
  });

  it("the cast names pictures the set has: seeding Éric and the others can never point at a missing one", () => {
    const people = new Set(listDefaults("person").map((i) => i.id));
    const banners = new Set(listDefaults("banner").map((i) => i.id));
    for (const p of castOf("akinaza")) {
      expect(people.has(p.avatar), `${p.id} avatar ${p.avatar}`).toBe(true);
      if (p.banner) expect(banners.has(p.banner), `${p.id} banner ${p.banner}`).toBe(true);
      expect(avatarChoice({ avatarSeed: p.avatar })).toBe(p.avatar);
    }
  });
});
