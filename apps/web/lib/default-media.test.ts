import { DEFAULT_MEDIA, defaultMediaPaths, SHOP_TYPES } from "@akinaza/core";
import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { defaultFileUrl, defaultImage, resolveDefaults } from "./default-media";
import manifest from "./default-media.manifest.json";
import { SETTINGS } from "./settings";

describe("the default media are on the CDN and described (#267)", () => {
  it("every path the data names is in the manifest, with a 10-hex hash, and nothing else is", () => {
    const files = manifest.files as Record<string, string>;
    const paths = defaultMediaPaths();
    expect(paths.filter((p) => !files[p]), "paths missing from lib/default-media.manifest.json").toEqual([]);
    expect(Object.keys(files).filter((p) => !paths.includes(p)), "manifest entries no default uses").toEqual([]);
    for (const hash of Object.values(files)) expect(hash).toMatch(/^[0-9a-f]{10}$/);
  });

  it("an address is the hashed object on the media zone: name.hash.ext under apps/akinaza/, never a guess", () => {
    const [path] = defaultMediaPaths();
    expect(defaultFileUrl(path!)).toMatch(/^https:\/\/krizaka-assets\.b-cdn\.net\/apps\/akinaza\/defaults\/.+\.[0-9a-f]{10}\.(avif|webp|webm|mp4)$/);
    expect(defaultFileUrl("defaults/nope/cover/x.webp")).toBeNull();
  });

  it("every default has its description in French and in English", () => {
    for (const m of DEFAULT_MEDIA) {
      for (const messages of [en, fr]) {
        const [, type, slot, n] = m.altKey.split(".");
        const text = (messages.console.defaultMedia as Record<string, Record<string, Record<string, string>>>)[type!]?.[slot!]?.[n!];
        expect(text, `${m.altKey} in ${messages === en ? "en" : "fr"}`).toBeTruthy();
      }
    }
  });

  it("every trade resolves a cover with its loop, four photos and three service images", () => {
    for (const type of SHOP_TYPES) {
      const d = resolveDefaults(type);
      expect(d.cover, type).not.toBeNull();
      expect(d.gallery, type).toHaveLength(4);
      expect(d.service, type).toHaveLength(3);
    }
    const image = defaultImage(DEFAULT_MEDIA.find((m) => m.slot === "service")!)!;
    expect(image.sources.map((s) => s.type)).toEqual(["image/avif", "image/webp"]);
    expect(image.width / image.height).toBeCloseTo(1.5, 1);
  });

  it("the translated labels of the trades exist", () => {
    for (const type of SHOP_TYPES) {
      expect((en.console.shopSetup.defaults.types as Record<string, string>)[type]).toBeTruthy();
      expect((fr.console.shopSetup.defaults.types as Record<string, string>)[type]).toBeTruthy();
    }
  });

  it("the administrator holds the switch and the trades offered, global, all on by default", () => {
    expect(SETTINGS["features.defaultMedia"]).toMatchObject({ default: true, scopes: ["global"] });
    expect(SETTINGS["storefront.defaultMedia.types"]).toMatchObject({ default: [...SHOP_TYPES], scopes: ["global"] });
    expect(SETTINGS["storefront.defaultMedia.types"].schema.safeParse(["salon", "restaurant"]).success).toBe(false);
  });
});

describe("each demo shop's images belong to its trade (akinaza#383)", () => {
  // A reviewed list: what may appear in the proposals of a trade, and the objects a trade must never show (« book » read as a noun on a hair salon).
  const OFF_TRADE: Record<string, RegExp> = {
    salon: /\b(book|books|notebook|laptop|paper|papers|desk|dog|bicycle|dumbbell|mat)s?\b/i,
    workshop: /\b(book|books|notebook|laptop|dog|towel|bottle)s?\b/i,
    consulting: /\b(dog|scissors|comb|bicycle|dumbbell|basin)s?\b/i,
    pets: /\b(book|books|notebook|laptop|scissors|comb|mirror)s?\b/i,
  };
  const alts = (type: string) => {
    const group = en.console.defaultMedia as Record<string, Record<string, Record<string, string>>>;
    return Object.values(group[type]!).flatMap((slot) => Object.values(slot));
  };

  it("the demo shops' trades are the ones the default images are drawn for", async () => {
    const { DEMO_SHOPS } = await import("@akinaza/db");
    const { latestTemplate } = await import("@akinaza/core");
    for (const demo of DEMO_SHOPS) {
      expect(SHOP_TYPES, demo.shop.slug).toContain(demo.shopType);
      expect(latestTemplate(demo.template)!.shopTypes, demo.template).toContain(demo.shopType);
      const resolved = resolveDefaults(demo.shopType);
      expect(resolved.cover?.id, demo.shop.slug).toMatch(new RegExp(`^${demo.shopType}-cover`));
      for (const image of [...resolved.gallery, ...resolved.service]) expect(image.id, demo.shop.slug).toMatch(new RegExp(`^${demo.shopType}-`));
    }
  });

  it("no description of a trade names an object the trade must not show", () => {
    for (const [type, banned] of Object.entries(OFF_TRADE)) for (const text of alts(type)) expect(text, `${type}: ${text}`).not.toMatch(banned);
  });

  it("the prompts the images are drawn from say the same", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const prompts = JSON.parse(readFileSync(join(__dirname, "../scripts/default-media/prompts.json"), "utf8")) as { types: Record<string, { cover: string[]; gallery: string[] }> };
    for (const [type, banned] of Object.entries(OFF_TRADE)) for (const text of [...prompts.types[type]!.cover, ...prompts.types[type]!.gallery]) expect(text, `${type}: ${text}`).not.toMatch(banned);
  });
});
