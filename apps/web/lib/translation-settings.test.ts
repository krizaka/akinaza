import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { SETTINGS } from "./settings";

describe("the administrator's side of the shop page's languages (#258)", () => {
  it("holds a switch (off until the Studio is wired), the allowed languages and a daily limit, all global", () => {
    expect(SETTINGS["features.storefrontTranslation"]).toMatchObject({ default: false, scopes: ["global"] });
    expect(SETTINGS["storefront.languages.allowed"]).toMatchObject({ default: ["fr", "en", "es"], scopes: ["global"], choices: ["fr", "en", "es"] });
    const limit = SETTINGS["limits.translationsPerShopPerDay"];
    expect(limit.scopes).toEqual(["global"]);
    expect(limit.schema.safeParse(limit.default).success).toBe(true);
    for (const value of [0, -1, 1.5, "20", (limit.max ?? 0) + 1]) expect(limit.schema.safeParse(value).success).toBe(false);
    expect(SETTINGS["storefront.languages.allowed"].schema.safeParse(["fr", "de"]).success).toBe(false);
  });

  it("never says « IA » or « AI » to the owner: it says automatic translation", () => {
    for (const messages of [en, fr]) {
      const text = JSON.stringify(messages.console.shopLanguages);
      expect(text).not.toMatch(/\bIA\b|\bAI\b|intelligen|artificial|artificielle/i);
    }
    expect(fr.console.shopLanguages.state.auto).toBe("Traduit automatiquement");
    expect(en.console.shopLanguages.state.auto).toBe("Translated automatically");
  });
});
