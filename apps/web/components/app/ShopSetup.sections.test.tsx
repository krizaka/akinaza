import { defaultShopPageConfig } from "@akinaza/db";
import { describe, expect, it, vi } from "vitest";

import { renderIn } from "@/lib/test-i18n";

import { RulesCard, type SetupData, ShopSetupView } from "./ShopSetup";

vi.mock("@/app/actions/remember-shop", () => ({ rememberShop: () => Promise.resolve() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, replace: () => undefined, push: () => undefined }), usePathname: () => "/en/app/s1/shop", useSearchParams: () => new URLSearchParams() }));

const page: NonNullable<SetupData["page"]> = { name: "Atelier Boréal", legalName: "Atelier Boréal inc.", address: "1234 rue Secrète, Montréal", slug: "atelier-boreal", ownerName: "Éric", taglineFr: "Du bon travail", taglineEn: "Good work", published: false, area: "Montréal", bioFr: "", bioEn: "", publicPhone: "", publicEmail: "", seatUnitFr: "", seatUnitEn: "", businessType: "professional" };
const data = (over: Partial<SetupData> = {}): SetupData => ({ page, shopId: "s1", pageConfig: defaultShopPageConfig(), proposed: null, templates: null, publicUrl: "https://www.akinaza.com/en/s/atelier-boreal", zones: [], services: [], media: { cover: null, gallery: [] }, windows: [], daysOff: [], rules: { cancellationHours: 24, bookingHorizonDays: 30, slotStepMinutes: 30, minNoticeMinutes: 0, reportLinkDays: 30, paymentTermsDays: 30 }, ...over });
const render = (d: SetupData, tab: Parameters<typeof ShopSetupView>[0]["tab"], locale: "en" | "fr" = "en") => renderIn(locale, "professional", <ShopSetupView data={d} tab={tab} />);
const text = (h: string) => h.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");

describe("« My shop page » in sections (#265)", () => {
  it("renders the section the hub opens, under its own title, and no tab strip: the hub's navigation names the sections", () => {
    const html = render(data(), "identity");
    expect(text(html)).toContain("Identity");
    // Under Boutique's h1, the section is an h2 (D6).
    expect(html).not.toMatch(/<h1[\s>]/);
    expect(html).toMatch(/<h2[^>]*>Identity<\/h2>/);
    expect(html).not.toContain('role="tablist"');
    expect(text(html)).not.toContain("Publish");
    expect(text(render(data(), "publish"))).toContain("Publish the page");
  });

  it("identity holds only who the shop is; the other fields live in their own section", () => {
    const t = text(render(data(), "identity"));
    for (const word of ["Shop name", "Legal name", "Your first name", "Page address"]) expect(t).toContain(word);
    for (const word of ["Phone shown to visitors", "Locality shown on the page", "One line"]) expect(t).not.toContain(word);
    expect(render(data(), "identity")).not.toContain('name="address"'); // the address is in Contact and place once the shop exists
  });

  it("the texts are French and English side by side, one save for the section", () => {
    const html = render(data(), "texts");
    expect(html).toContain('name="taglineFr"');
    expect(html).toContain('name="taglineEn"');
    expect(html.indexOf('name="taglineFr"')).toBeLessThan(html.indexOf('name="taglineEn"'));
    expect(html.match(/type="submit"/g)).toHaveLength(1);
  });

  it("every text control says its language in its own label, on a phone as on a desktop", () => {
    const html = render(data(), "texts");
    const labels = [...html.matchAll(/<label[^>]*for="([^"]*)"[^>]*>([^<]*)<\/label>/g)].map((m) => m[2]!);
    expect(labels).toEqual(expect.arrayContaining(["One line, in French", "One line, in English", "Who you are (French)", "Who you are (English)", "What a seat is called (French)", "What a seat is called (English)"]));
    expect(new Set(labels).size).toBe(labels.length); // no two controls share a label
    expect(html).not.toMatch(/hidden[^"]*sm:block/); // no language heading that disappears below sm
  });

  it("the street address is said to be private, in its own section", () => {
    const t = text(render(data(), "contact"));
    expect(t).toContain("never shown on your public page");
    expect(t).toContain("Locality shown on the page");
  });

  it("publish shows the switch and the public link", () => {
    const t = text(render(data({ page: { ...page, published: true } }), "publish"));
    expect(t).toContain("Publish the page");
    expect(t).toContain("https://www.akinaza.com/en/s/atelier-boreal");
  });

  it("a person with no shop yet gets the identity form only, no tabs, and it collects the address the server requires", () => {
    const html = render(data({ page: null, shopId: null, publicUrl: null }), "identity");
    expect(text(html)).toContain("Shop name");
    expect(html).toContain('name="address"');
    expect(text(html)).not.toContain("Photos and video");
  });

  it("speaks French", () => {
    const t = text(render(data(), "contact", "fr"));
    for (const word of ["Contact et lieu", "jamais affichée sur votre page publique"]) expect(t).toContain(word);
  });
});

describe("« Look » holds the page template (#261, step 4)", () => {
  it("shows the picker first in the tab when the administrator offers templates, nothing of it otherwise", async () => {
    const { templatesFor } = await import("@akinaza/core");
    const html = render(data({ templates: { shopType: "salon", choices: templatesFor("salon"), preselected: "salon-carte", current: null, updateAvailable: null, sectionsCustom: false } }), "look");
    const t = text(html);
    expect(t).toContain("Page template");
    expect(t.indexOf("Page template")).toBeLessThan(t.indexOf("Page sections"));
    expect(text(render(data(), "look"))).not.toContain("Page template");
  });
});

describe("payment terms live in Invoices, not in Booking rules (krizaka-internal#1911)", () => {
  const rules = { cancellationHours: 24, bookingHorizonDays: 30, slotStepMinutes: 30, minNoticeMinutes: 0, reportLinkDays: 30, paymentTermsDays: 45 };
  const card = (part?: "rules" | "terms") => renderIn("en", "professional", <RulesCard rules={rules} part={part} />);

  it("Booking rules no longer hold the payment terms", () => {
    const html = card();
    expect(html).toContain('name="cancellationHours"');
    expect(html).not.toContain('name="paymentTermsDays"');
  });

  it("Invoices holds only the payment terms, under their own title", () => {
    const html = card("terms");
    expect(html).toContain('name="paymentTermsDays"');
    expect(html).not.toContain('name="cancellationHours"');
    expect(text(html)).toContain("Payment terms");
  });
});
