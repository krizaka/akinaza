import { BUSINESS_TYPES } from "@akinaza/core";
import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { entries, overlayOf, type Tree, wordsFor } from "./vocabulary";

const LOCALES = { en: en.console as unknown as Tree, fr: fr.console as unknown as Tree };

/** The words of the dog walker: what a studio, a consultant or a repairer must never read on its own screens. */
const DOG_WORDS = {
  en: /\b(walks?|walkers?|walking|dogs?|pups?|puppy|pets?|leash|breed|vet|groom\w*)\b|Saint-Henri/i,
  fr: /promenad|chiens?\b|chiot|toutou|\ben laisse\b|\banimal|animaux|vétérin|\brace\b|Saint-Henri/i,
};

/** What only a pet-care shop reaches (its dependants and its visit reports): the other business types never show these. */
const PET_ONLY = /^(clients\.(dogs|kinds|sizes|profile|vet|emergency)|book\.(dogTitle|dogName|breed|size|temperament|temperamentHint|vet\w*|emergency\w*|addDog|addAnother|needDog|dogs|dogsHint|access\w*)|walker\.(dogs|dogsOf|reveal|hide|noNotes|notesTitle|reportTitle|note|notePlaceholder|photo\w*|save|saved|send|sendAgain|sentOn|sentNow|queued|failed)|report\.|meta\.report|client\.dogsTitle|errors\.(VISIT_NOT_DONE|NO_CONSENT|CLIENT_UNREACHABLE|BOOKING_OWNERSHIP|DEPENDANTS_REQUIRED|ACCESS_\w+|PHOTO_\w+|REPORT_\w+))/;
/** Not the signed-in screens of a shop: the marketing site, the legal text and the administration. */
/** The picker names the other type by design; « walk-in » is the salon's word for a client without an appointment. */
const NAMES_THE_OTHER_TYPE = /^(shopSetup\.page\.businessTypes\.pets|today\.walkIn)$/;
const NOT_A_SHOP_SCREEN = /^(admin|adminSignIn|signIn|vocabularies)\b/;

describe.each(Object.entries(LOCALES))("the professional vocabulary, %s", (locale, console_) => {
  const words = entries(wordsFor(console_, "professional"));

  it("has none of the dog walker's words on a shop's screens", () => {
    const leaks = words.filter(([key, value]) => !NOT_A_SHOP_SCREEN.test(key) && !PET_ONLY.test(key) && !NAMES_THE_OTHER_TYPE.test(key) && DOG_WORDS[locale as "en" | "fr"].test(value.replace(/\{\w+\}/g, "")));
    expect(leaks.map(([key, value]) => `${key} = ${value}`)).toEqual([]);
  });

  it("overrides only messages that exist, with the same {placeholders}", () => {
    const base = new Map(entries(wordsFor(console_, "pets")));
    const overlay = overlayOf(console_, "professional");
    expect(overlay).toBeDefined();
    const holes: string[] = [];
    for (const [key, value] of entries(overlay!)) {
      const original = base.get(key);
      if (original === undefined) holes.push(`${key}: not a message`);
      else if ([...original.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join() !== [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join()) holes.push(`${key}: placeholders differ`);
    }
    expect(holes).toEqual([]);
  });
});

describe("the pet-care vocabulary", () => {
  it("is the base words: it keeps the dog walker's screens as they were", () => {
    for (const console_ of Object.values(LOCALES)) {
      expect(wordsFor(console_, "pets")).toMatchObject({ walker: { title: expect.any(String) } });
      expect(overlayOf(console_, "pets")).toBeUndefined();
    }
    expect(wordsFor(LOCALES.en, "pets")).toMatchObject({ walker: { title: "Today's walks" }, shopSetup: { services: { capacity: "Dogs per walk" } } });
  });

  it("every business type has its words in both languages", () => {
    for (const type of BUSINESS_TYPES.filter((t) => t !== "pets")) {
      expect(Object.keys(overlayOf(LOCALES.en, type) ?? {}).sort()).toEqual(Object.keys(overlayOf(LOCALES.fr, type) ?? {}).sort());
    }
  });
});
