import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import enRaw from "@/messages/en.json";

import { type LanguagesData, ShopLanguages } from "./ShopLanguages";
import { bindProduct } from "@/lib/brand";

const en = bindProduct(enRaw);

const say = (key: string, vars?: Record<string, string | number>) => {
  const value = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], en.console) as string;
  return vars ? Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), value) : value;
};
vi.mock("@/lib/i18n-client", () => ({ useSay: () => ({ say, locale: "en" }) }));
vi.mock("@/components/app/useCall", () => ({ useCall: () => ({ run: vi.fn(), pending: false, problem: null }) }));

const data = (over: Partial<LanguagesData> = {}): LanguagesData => ({
  source: "fr",
  enabled: ["fr", "en", "es"],
  allowed: ["fr", "en", "es"],
  translationOn: true,
  dailyLimit: 20,
  usedToday: 3,
  setupHref: "/en/app/s1/shop",
  fields: [
    { key: "shop:s1:tagline", kind: "shop", field: "tagline", owner: null, source: "Coiffure de quartier", languages: { en: { state: "own", text: "Neighbourhood hair" }, es: { state: "auto", text: "Peluquería de barrio" } } },
    { key: "shop:s1:bio", kind: "shop", field: "bio", owner: null, source: "Julie vous reçoit.", languages: { en: { state: "missing", text: "" }, es: { state: "stale", text: "Julie le recibe." } } },
    { key: "service:c1:name", kind: "service", field: "name", owner: null, source: "Coupe", languages: { en: { state: "edited", text: "Haircut" }, es: { state: "missing", text: "" } } },
  ],
  ...over,
});
const html = (d: LanguagesData) => renderToStaticMarkup(<ShopLanguages data={d} />);
const text = (h: string) => h.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("the owner's screen for the shop page's languages (#258)", () => {
  it("shows each text beside its translation, with its state, in each language that is on", () => {
    const t = text(html(data()));
    for (const word of ["Languages of your page", "Written by you", "Translated automatically", "Edited by you", "To review", "Not translated", "Translate"]) expect(t).toContain(word);
    expect(t).toContain("Coiffure de quartier");
    expect(html(data())).toContain("Peluquería de barrio");
    expect(t).toContain("3 of 20 translations used today");
  });

  it("an automatic or edited text can be redone, a text the owner wrote in that language cannot be replaced from here", () => {
    const t = text(html(data()));
    expect(t).toContain("Redo the translation");
    expect(html(data({ fields: [data().fields[0]!] }))).toContain("readOnly");
  });

  it("without the administrator's switch the screen says so and offers no run, but texts stay editable", () => {
    const t = text(html(data({ translationOn: false })));
    expect(t).toContain("Automatic translation is not available yet");
    expect(t).not.toContain("Redo the translation");
    expect(t).toContain("Save my wording");
  });

  it("offers only the languages the administrator allows (and the source)", () => {
    const h = html(data({ enabled: ["fr"], allowed: ["fr", "en"] }));
    expect(h).toContain("Offer the page in English");
    expect(h).not.toContain("Offer the page in Spanish");
  });

  it("nothing in it says AI", () => {
    expect(text(html(data()))).not.toMatch(/\bAI\b|\bIA\b/);
  });
});
