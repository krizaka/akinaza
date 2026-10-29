import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { DEMO_SLUGS, DEVICES, flagsOf, plan, SCENES, shotName, THEMES } from "./shots-storefront.mjs";

const source = readFileSync(new URL("./shots-storefront.mjs", import.meta.url), "utf8");

describe("shots-storefront (the captures of #261 on a seeded database)", () => {
  it("captures every scene in dark and light, on a desktop and on a phone, with stable file names", () => {
    expect(THEMES).toEqual(["dark", "light"]);
    expect(Object.keys(DEVICES)).toEqual(["desktop", "phone"]);
    expect(DEVICES.phone.width).toBeLessThan(DEVICES.desktop.width);
    const all = plan();
    expect(all).toHaveLength(Object.keys(SCENES).length * 2 * 2);
    expect(all.map((s) => s.file).slice(0, 4)).toEqual(["look-desktop-dark.png", "look-desktop-light.png", "look-phone-dark.png", "look-phone-light.png"]);
    expect(shotName("storefront", "phone", "light")).toBe("storefront-phone-light.png");
    expect(() => plan(["nope"])).toThrow(/unknown scene/);
    expect(plan(["new"]).every((s) => s.scene === "new")).toBe(true);
    expect(plan(["new"], ["phone"]).map((s) => s.file)).toEqual(["new-phone-dark.png", "new-phone-light.png"]);
    expect(() => plan(["new"], ["tablet"])).toThrow(/unknown scene\(s\) or device/);
  });

  it("names the owner's views by the shop's id and the public page by its slug, each with what must be visible, in both languages", () => {
    const shop = { id: "shop-1", slug: "pattes-saint-henri" };
    expect(SCENES.look.path("fr", shop)).toBe("/fr/app/shop-1/shop?tab=look");
    expect(SCENES.new.path("en", shop)).toBe("/en/app/shop-1/shop/new");
    expect(SCENES.storefront.path("fr", shop)).toBe("/fr/s/pattes-saint-henri");
    expect([SCENES.salon, SCENES.workshop, SCENES.consulting].map((s) => s.path("fr", shop))).toEqual(["/fr/s/cedre-ciseaux", "/fr/s/encre-vive", "/fr/s/ferland-conseil"]);
    for (const scene of Object.values(SCENES)) expect(scene.expect).toMatchObject({ fr: expect.any(String), en: expect.any(String) });
    expect(SCENES.salon.expect.fr).toBe("Salon Cèdre & Ciseaux"); // the heading, there on every device
    expect(SCENES.look.signedIn).toBe(true);
    expect(SCENES.storefront.signedIn).toBe(false);
  });

  it("runs on a throw-away database with passwords generated for the run, never printed, and removes the container whatever happens", () => {
    expect(source).toContain("docker");
    expect(source).toMatch(/crypto\.randomBytes\(\d+\)/);
    expect(source).not.toMatch(/console\.log\([^)]*password/i);
    expect(source).not.toMatch(/password:\s*["'`][^"'`]{6,}["'`]/i);
    expect(source).toMatch(/finally \{[\s\S]*docker[\s\S]*"rm", "-f"/);
    expect(source).toContain('localStorage.setItem("kz-theme", t)');
    expect(source).toContain('reducedMotion: "reduce"'); // the revealed sections are in the shot
    expect(source).toContain("features.storefrontTemplates");
    expect(source).toMatch(/const attempt = new pg\.Client/); // a failed pg Client cannot reconnect: one per attempt
    expect(source).toMatch(/DATABASE_DIRECT_URL: ""/); // migrations prefer the direct URL: the run must never migrate a real deployment
  });
});

describe("the owner's guide's captures (akinaza#382)", () => {
  it("has one scene per page of the guide, taken from the demo shop's own views", async () => {
    const { DOCS_SCENES } = await import("./shots-storefront.mjs");
    expect(DOCS_SCENES).toEqual(["docs-shop", "docs-bookings", "docs-invoices", "docs-books", "docs-data"]);
    const shop = { id: "shop-1", slug: "pattes-saint-henri" };
    expect(SCENES["docs-books"].path("en", shop)).toBe("/en/app/shop-1/books");
    expect(SCENES["docs-data"].path("fr", shop)).toBe("/fr/app/profile/data");
    for (const s of DOCS_SCENES) expect(SCENES[s].expect).toMatchObject({ fr: expect.any(String), en: expect.any(String) });
    const script = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).scripts["shots:docs"];
    for (const s of DOCS_SCENES) expect(script).toContain(s);
  });
});

describe("flagsOf: features switched on for a capture run only", () => {
  it("reads a comma list and keeps only feature keys", () => {
    expect(flagsOf("features.cahierStorefront, features.x ,plans.free.apiKeys,;rm")).toEqual(["features.cahierStorefront", "features.x"]);
    expect(flagsOf(undefined)).toEqual([]);
  });
});

describe("the demo shops' own flag (akinaza#261)", () => {
  it("names the three demo shops and nothing else", () => {
    expect(DEMO_SLUGS).toEqual(["cedre-ciseaux", "encre-vive", "ferland-conseil"]);
  });
});
