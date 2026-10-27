import { parseShopPage } from "@krizaka/ui/shop";
import { describe, expect, it } from "vitest";

import { SHOP_TYPES } from "./shop-media";
import { demoLookDocument, demoLooksOf, documentFromLegacy, LEGACY_SECTION_IDS, starterFor } from "./shop-page-document";

const all = LEGACY_SECTION_IDS.map((id) => ({ id, visible: true }));

describe("the shop page document", () => {
  it.each(SHOP_TYPES)("turns today's page of a %s into a valid document", (trade) => {
    const parsed = parseShopPage(documentFromLegacy({ sections: all, trade }));
    expect(parsed.ok).toBe(true);
  });

  it("keeps the order and the visibility: a hidden section is disabled, not lost", () => {
    const order = ["reviews", "services", "trust", "hours", "team", "zones", "gallery", "wall", "reels", "announcements", "follow"] as const;
    const doc = documentFromLegacy({ sections: order.map((id) => ({ id, visible: id !== "wall" })), trade: "salon" });
    const keys = doc.sections.map((s) => s.key);
    expect(keys[0]).toBe("s_hero");
    expect(keys.slice(1, 5)).toEqual(["s_reviews", "s_services", "s_trust_1", "s_trust_2"]);
    expect(keys.slice(-2)).toEqual(["s_booking_panel", "s_booking_sticky"]);
    expect(doc.sections.filter((s) => s.disabled).map((s) => s.key)).toEqual(["s_wall"]);
    expect(parseShopPage(doc).ok).toBe(true);
  });

  it("reads a list that predates trust with it before the gallery", () => {
    const doc = documentFromLegacy({ sections: all.filter((s) => s.id !== "trust"), trade: "salon" });
    const keys = doc.sections.map((s) => s.key);
    expect(keys.indexOf("s_trust_1")).toBe(keys.indexOf("s_gallery") - 2);
  });

  it("starts a salon on the compact starter and pets on the route", () => {
    expect(parseShopPage(starterFor("salon")).ok).toBe(true);
    expect(starterFor("salon")).toEqual(starterFor("salon"));
    expect(starterFor("pets").preset.id).toMatch(/^pets-/);
  });
});

describe("the demo looks (akinaza#404)", () => {
  it("offers three looks to the salon and two to the dog walker, and none to another shop", () => {
    expect(demoLooksOf("cedre-ciseaux").map((l) => l.id)).toEqual(["compact", "editorial", "gallery"]);
    expect(demoLooksOf("pattes-saint-henri").map((l) => l.id)).toEqual(["route", "journal"]);
    expect(demoLooksOf("any-real-shop")).toEqual([]);
  });
  it("draws another look as a valid document, and never the first (the page's own) or an unknown one", () => {
    const editorial = demoLookDocument("cedre-ciseaux", "editorial");
    expect(editorial?.preset.id).toBe("salon-atelier");
    expect(parseShopPage(editorial).ok).toBe(true);
    expect(demoLookDocument("cedre-ciseaux", "compact")).toBeNull();
    expect(demoLookDocument("cedre-ciseaux", "nope")).toBeNull();
    expect(demoLookDocument("pattes-saint-henri", "journal")?.preset.id).toBe("pets-carnet");
  });
  it("ignores ?look= on a shop that is not a demo", () => {
    expect(demoLookDocument("any-real-shop", "editorial")).toBeNull();
  });
});
