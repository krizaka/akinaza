import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { DEMO_SHOP, heroActions, HOME_SECTIONS, productStatus, SCREENS } from "./landing";
import { llmsText } from "./seo";
import { heroTake, MEDIA_CDN, screenStill } from "./tour";

const ROOT = join(__dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const words = (node: unknown): string[] => (typeof node === "string" ? [node] : node && typeof node === "object" ? Object.values(node).flatMap(words) : []);

describe("the home is short and concrete", () => {
  const home = read("app/[locale]/page.tsx");

  it("is a LandingPage: one benefit line, the real app on a phone, three screens, one way in", () => {
    expect(home).toContain('from "@krizaka/ui/landing-page"');
    for (const prop of ["title=", "lead=", "visual={", "features={"]) expect(home).toContain(prop);
    expect(home).toContain("<HeroPhone");
    expect(HOME_SECTIONS).toEqual(["hero", "screens", "offer", "trust"]);
    expect(SCREENS.map((s) => s.id)).toEqual(["book", "invoice", "books"]);
  });

  it("carries no filler: no eyebrow, figures band, mascot, comparison, FAQ, changelog or closing panel", () => {
    for (const needle of ["eyebrow=", "proofs={", "MascotQuote", "NumberTicker", "ComparisonSection", "FaqSection", "JourneyTour", "closing={{"]) expect(home, needle).not.toContain(needle);
  });

  it("has exactly one primary action: the way in", () => {
    expect((home.match(/variant="primary"/g) ?? []).length).toBe(1);
  });

  it("each screen is a real capture with its text and alt in both languages, on the CDN", () => {
    for (const locale of ["en", "fr"] as const) {
      for (const { id } of SCREENS) {
        const base = `${MEDIA_CDN}/site/products/akinaza/tour/phone-${id}-${locale}.`;
        expect(screenStill(id, locale).startsWith(base)).toBe(true);
        expect(screenStill(id, locale).slice(base.length)).toMatch(/^[0-9a-f]{10}\.jpg$/);
        for (const m of [en, fr]) expect(m.landing.screens[id].title && m.landing.screens[id].text && m.landing.screens[id].alt, id).toBeTruthy();
      }
    }
  });

  it("says its honest status, read from dev-preview.json", () => {
    const preview = JSON.parse(read("../../dev-preview.json")) as { criteria: Record<string, { evidence?: string | null; na?: string }> };
    const gaps = Object.values(preview.criteria).some((c) => !c.evidence && !c.na);
    expect(productStatus(preview)).toBe(gaps ? "development" : "preview");
    expect(productStatus({ criteria: { a: { na: "no mobile app" }, b: { evidence: "https://x" } } })).toBe("preview");
    expect(productStatus({ criteria: { a: { evidence: null }, b: { na: "x" } } })).toBe("development");
  });

  it("keeps the trust line quiet: the database in Canada (public-claims.test.ts), consent by purpose, prepared never filed, and not for restaurants, cafés and bars", () => {
    for (const m of [en, fr]) {
      expect(m.landing.trust.line).toMatch(/Canada/);
      expect(m.landing.trust.line).not.toMatch(/Loi 25|Loi 96|Law 25|Law 96/);
      expect(m.landing.trust.scope).toMatch(/restaurants, cafés, bars/);
      expect(JSON.stringify(m.landing)).not.toMatch(/\b(we|on) (file|transmet)|files? (it|your return) for you|transmission électronique|transmet(tons)? à Revenu/i);
      expect(m.landing.screens.books.text).toMatch(/never|jamais|yourself|vous-même|produisez|file the return/i);
    }
  });
});

describe("the words are plain: no AI, no hype, no engine on the public pages", () => {
  const HYPE = /\bIA\b|\bAI\b|intelligen|artificial|assistant|orazaka|révolution|revolution|magic|magique|cutting-edge|game-chang/i;
  it("the landing, the meta and llms.txt never say it", () => {
    for (const m of [en, fr]) expect(words([m.landing, m.meta]).filter((w) => HYPE.test(w))).toEqual([]);
    expect(llmsText()).not.toMatch(HYPE);
  });
  it("the hero is short, in plain French first", () => {
    for (const m of [en, fr]) {
      expect(m.landing.title.length).toBeLessThanOrEqual(60);
      expect(m.landing.lead.length).toBeLessThanOrEqual(120);
      expect(words(m.landing)).not.toContain("—");
    }
    expect(fr.landing.title).toBe("Vos rendez-vous, vos factures et vos taxes, réglés.");
  });
  it("claims « designed for », never « compliant »", () => {
    const everything = JSON.stringify([en.meta, en.landing, fr.meta, fr.landing]) + llmsText();
    expect(everything).not.toMatch(/conforme|conformité|compliant|compliance|complies with|certified for/i);
  });
  it("excludes restaurants, cafés, bars and bakeries, and llms.txt says so", () => {
    expect(llmsText()).toMatch(/restaurants, cafés, bars/i);
  });
});

describe("the first screen loads its proof first", () => {
  it("preconnects to the media CDN and preloads the hero take's poster (the LCP) at high priority", () => {
    const home = read("app/[locale]/page.tsx");
    expect(home).toMatch(/preconnect\(MEDIA_CDN/);
    expect(home).toMatch(/<link rel="preload" as="image" href=\{heroTake\(locale\)\.poster\} fetchPriority="high" \/>/);
  });
  it("the hero is the whole take: a muted looping video over its poster, still under reduced motion", () => {
    for (const locale of ["en", "fr"] as const) {
      const take = heroTake(locale);
      expect(take.poster).toMatch(/\/phone-hero-\w\w\.[0-9a-f]{10}\.jpg$/);
      expect(take.webm).toMatch(/\/hero-\w\w\.[0-9a-f]{10}\.webm$/);
    }
    const video = read("components/home/HeroTake.tsx");
    for (const needle of ["muted", "loop", "playsInline", "poster={poster}", "prefers-reduced-motion", "saveData"]) expect(video).toContain(needle);
    expect(video).not.toContain("autoPlay");
  });
  it("the CSP lets the CDN serve media (a video is not an image)", () => {
    expect(read("next.config.mjs")).toContain("media-src 'self' https://krizaka-assets.b-cdn.net");
  });
});

describe("the bar", () => {
  it("carries no version chip (the version is in the footer) and groups the product's pages in one menu", () => {
    const bar = read("components/SiteChrome.tsx");
    expect(bar).not.toContain("NavBar.Badge");
    expect(bar).not.toContain("APP_VERSION");
    expect(bar).toContain("NavBar.Menu");
  });
});

describe("the bar's language switch", () => {
  it("is the family's (a globe and the current code), in the bar and in the phone panel's preferences — never a pill naming the other language", () => {
    const bar = read("components/SiteChrome.tsx");
    expect(bar).toContain("NavBar.Language");
    expect(bar).toContain("NavBar.MobilePreferences");
    expect(bar).toContain("languagesFor(");
    expect(bar).not.toContain("hrefLang");
    expect(bar).not.toContain("otherLocale");
  });
});

describe("the responsive guard", () => {
  it("is a script that checks 360, 390, 430, 768, 1024 and 1440 px in both themes, and CI runs it", () => {
    const script = readFileSync(join(ROOT, "../../scripts/check-overflow.mjs"), "utf8");
    expect(script).toContain("export const WIDTHS = [360, 390, 430, 768, 1024, 1440]");
    expect(script).toContain('["dark", "light"]');
    expect(JSON.parse(readFileSync(join(ROOT, "../../package.json"), "utf8")).scripts["check:overflow"]).toBe("node scripts/check-overflow.mjs");
    // The pipeline is the org's node-ci.yml; its `after-build` step runs this repository's script after the production build.
    expect(readFileSync(join(ROOT, "../../.github/workflows/ci.yml"), "utf8")).toContain("after-build: scripts/ci-after-build.sh");
    expect(readFileSync(join(ROOT, "../../scripts/ci-after-build.sh"), "utf8")).toContain("check:overflow");
  });
});

describe("the hero follows the session (krizaka/akinaza#285)", () => {
  const label = (dict: typeof en, message: "openShop" | "tryDemo" | "signIn") => dict.landing.actions[message];

  it("signed out, EN: « Try the demo shop » first, « Sign in » second", () => {
    const { primary, secondary } = heroActions("en", false);
    expect(primary).toEqual({ href: `/en/s/${DEMO_SHOP}`, message: "tryDemo" });
    expect(label(en, primary.message)).toBe("Try the demo shop");
    expect(secondary && label(en, secondary.message)).toBe("Sign in");
    expect(secondary?.href).toBe("/en/sign-in");
  });

  it("signed out, FR: « Essayer la boutique démo » and « Se connecter »", () => {
    const { primary, secondary } = heroActions("fr", false);
    expect(label(fr, primary.message)).toBe("Essayer la boutique démo");
    expect(secondary && label(fr, secondary.message)).toBe("Se connecter");
    expect(primary.href).toBe(`/fr/s/${DEMO_SHOP}`);
  });

  it("signed in, EN and FR: one primary « Open my shop » / « Ouvrir ma boutique » into the owner's app, no second action", () => {
    for (const [locale, dict, text] of [["en", en, "Open my shop"], ["fr", fr, "Ouvrir ma boutique"]] as const) {
      const { primary, secondary } = heroActions(locale, true);
      expect(primary.href).toBe(`/${locale}/app`);
      expect(label(dict, primary.message)).toBe(text);
      expect(secondary).toBeNull();
    }
  });
});
