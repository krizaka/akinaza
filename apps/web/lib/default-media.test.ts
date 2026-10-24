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

  it("an address is the hashed object on the media zone: name.hash.ext under site/, never a guess", () => {
    const [path] = defaultMediaPaths();
    expect(defaultFileUrl(path!)).toMatch(/^https:\/\/krizaka-assets\.b-cdn\.net\/site\/products\/akinaza\/defaults\/.+\.[0-9a-f]{10}\.(avif|webp|webm|mp4)$/);
    expect(defaultFileUrl("products/akinaza/defaults/nope/cover/x.webp")).toBeNull();
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
