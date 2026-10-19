import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { COMPARE_ROWS, DEMO_SHOP, FAQ_IDS, FIGURES, HOME_SECTIONS, OUTCOMES, productStatus } from "./landing";
import { MEDIA_CDN, storefrontStill, TOUR, tourClip, tourStill } from "./tour";

const ROOT = join(__dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const words = (node: unknown): string[] => (typeof node === "string" ? [node] : node && typeof node === "object" ? Object.values(node).flatMap(words) : []);

describe("the landing is the product landing template of @krizaka/ui, at the Yomizaka level", () => {
  const home = read("app/[locale]/page.tsx");

  it("is a LandingPage: the real storefront in a phone as the hero's visual, a band of figures, a bento, our sections, the closing call", () => {
    expect(home).toContain('from "@krizaka/ui/landing-page"');
    for (const prop of ["eyebrow=", "visual={", "visualLabel=", "proofs={[", "features={", "closing={{"]) expect(home).toContain(prop);
    expect(home).toContain("<HeroPhone");
    expect(read("components/home/HeroPhone.tsx")).toContain('kind="phone"');
    expect(read("components/home/HeroPhone.tsx")).toContain("storefrontStill()");
  });

  it("tells its story in this order", () => {
    expect(HOME_SECTIONS).toEqual(["hero", "features", "how", "compare", "trust", "faq", "closing"]);
    const marks = ["<LandingPage", "features={", 'id="how"', "<ComparisonSection", 'id="trust"', "<FaqSection", "closing={{"];
    const at = marks.map((m) => home.indexOf(m));
    expect(at.every((i) => i >= 0)).toBe(true);
    const body = at.slice(0, -1);
    expect([...body].sort((a, b) => a - b)).toEqual(body);
  });

  it("uses the family's blocks: NumberTicker, the recorded StepShowcase, ComparisonTable, the beaver", () => {
    expect(home).toContain("<NumberTicker");
    expect(home).toContain("<JourneyTour");
    expect(read("components/home/ComparisonSection.tsx")).toContain("@krizaka/ui/comparison-table");
    expect(home).toContain('bird="beaver"');
  });

  it("has one primary action in the hero and one in the closing call", () => {
    expect((home.match(/variant="primary"/g) ?? []).length).toBe(2);
  });

  it("the figures are the tax code's rates and the languages, read from @akinaza/core", () => {
    expect(FIGURES).toEqual({ gst: 5, qst: 9.975, languages: 2 });
    expect(home).toContain("FIGURES.gst");
    expect(home).toContain("FIGURES.qst");
  });

  it("compares on five honest rows and answers the FAQ, in both languages", () => {
    for (const m of [en, fr]) {
      for (const id of COMPARE_ROWS) expect(m.landing.compare.rows[id].akinaza.key && m.landing.compare.rows[id].stack.key, id).toBeTruthy();
      for (const id of FAQ_IDS) expect(m.landing.faq.items[id].q && m.landing.faq.items[id].a, id).toBeTruthy();
      expect(Object.entries(m.landing.faq.items).filter(([, v]) => /orazaka/i.test(v.a)).map(([k]) => k)).toEqual(["engine"]);
      expect(m.landing.faq.items.engine.a).toMatch(/planned|prévu/i);
      // the return is never filed by Akinaza, and the comparison says who files
      expect(m.landing.faq.items.filing.a).toMatch(/never|jamais/i);
      expect(m.landing.compare.rows.filing.akinaza.detail).toMatch(/never|jamais/i);
    }
  });

  it("names Orazaka only as the engine: not in the hero, features, tour, comparison or figures", () => {
    for (const m of [en, fr]) {
      const pitch = [m.landing.eyebrow, m.landing.title, m.landing.lead, m.landing.hero, m.landing.figures, m.landing.features, m.landing.outcomes, m.landing.tour, m.landing.how, m.landing.compare];
      expect(words(pitch).filter((w) => /orazaka/i.test(w))).toEqual([]);
    }
  });

  it("shows three outcomes, each a way in — the first, the real demo shop's booking page", () => {
    expect(OUTCOMES).toHaveLength(3);
    expect(OUTCOMES[0]).toMatchObject({ id: "bookings", to: "shop" });
    expect(DEMO_SHOP).toBe("pattes-saint-henri");
    for (const o of OUTCOMES) expect(en.landing.outcomes[o.id].cta.length).toBeGreaterThan(0);
  });

  it("says its honest status, read from dev-preview.json", () => {
    const preview = JSON.parse(read("../../dev-preview.json")) as { criteria: Record<string, { evidence: string | null; na?: boolean }> };
    const gaps = Object.values(preview.criteria).some((c) => c.evidence === null && !c.na);
    expect(productStatus(preview)).toBe(gaps ? "development" : "preview");
  });

  it("prepares the tax return and never files it, is not for restaurants and bars, and says Orazaka is planned until it is wired", () => {
    for (const m of [en, fr]) {
      const text = JSON.stringify(m.landing);
      expect(text).not.toMatch(/\b(we|on) (file|transmet)|files? (it|your return) for you|transmission électronique|transmet(tons)? à Revenu/i);
    }
    expect(en.landing.trust.lead).toMatch(/restaurants and bars/);
    expect(fr.landing.trust.lead).toMatch(/restaurants et (les )?bars/);
    const preview = JSON.parse(read("../../dev-preview.json")) as { criteria: Record<string, { evidence: string | null }> };
    if (preview.criteria["journey.ai-via-orazaka"]?.evidence === null) expect(en.landing.trust.powered).toMatch(/planned/i);
  });

  it("speaks the beaver's promise as the film says it", () => {
    expect(en.landing.how.beaver).toBe("The beaver builds the shop.");
    expect(fr.landing.how.beaver).toBe("Le castor construit la boutique.");
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

describe("the first screen loads its proof first", () => {
  it("preconnects to the media CDN and preloads the storefront still (the LCP) at high priority", () => {
    const home = read("app/[locale]/page.tsx");
    expect(home).toMatch(/preconnect\(MEDIA_CDN/);
    expect(home).toMatch(/<link rel="preload" as="image" href=\{storefrontStill\(\)\} fetchPriority="high" \/>/);
  });
});

describe("the tour plays the walker journey's recording, stills first", () => {
  it("every step carries its clip (webm + mp4, hashed on the CDN) and keeps its still as the poster", () => {
    const home = read("app/[locale]/page.tsx");
    expect(home).toMatch(/poster: tourStill\(id\), video: tourClip\(id\)/);
    for (const step of TOUR.steps) {
      const clip = tourClip(step);
      expect(clip.webm).toMatch(new RegExp(`^${MEDIA_CDN}/site/products/akinaza/tour/${step}\\.[0-9a-f]{10}\\.webm$`));
      expect(clip.mp4).toMatch(new RegExp(`^${MEDIA_CDN}/site/products/akinaza/tour/${step}\\.[0-9a-f]{10}\\.mp4$`));
      expect(tourStill(step)).toMatch(/\.jpg$/);
      expect(en.landing.tour.steps[step].title && fr.landing.tour.steps[step].title).toBeTruthy();
    }
  });

  it("the CSP lets the CDN serve media (a video is not an image)", () => {
    expect(read("next.config.mjs")).toContain("media-src 'self' https://krizaka-assets.b-cdn.net");
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

describe("the storefront still", () => {
  it("is on the CDN under a hashed name and shows the shop's public page", () => {
    const still = storefrontStill();
    expect(still.startsWith(`${MEDIA_CDN}/site/products/akinaza/tour/phone-storefront.`)).toBe(true);
    expect(still.slice(MEDIA_CDN.length)).toMatch(/^\/site\/products\/akinaza\/tour\/phone-storefront\.[0-9a-f]{10}\.jpg$/);
  });
});

describe("the responsive guard", () => {
  it("is a script that checks 360, 390, 430, 768, 1024 and 1440 px in both themes, and CI runs it", () => {
    const script = readFileSync(join(ROOT, "../../scripts/check-overflow.mjs"), "utf8");
    expect(script).toContain("export const WIDTHS = [360, 390, 430, 768, 1024, 1440]");
    expect(script).toContain('["dark", "light"]');
    expect(JSON.parse(readFileSync(join(ROOT, "../../package.json"), "utf8")).scripts["check:overflow"]).toBe("node scripts/check-overflow.mjs");
    expect(readFileSync(join(ROOT, "../../.github/workflows/ci.yml"), "utf8")).toContain("check:overflow");
  });
});
