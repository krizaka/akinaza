import { describe, expect, it, vi } from "vitest";

import { renderIn } from "@/lib/test-i18n";

import { BoutiqueHub, type BoutiqueHubProps } from "./BoutiqueHub";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, replace: () => undefined, push: () => undefined }), usePathname: () => "/en/app/s1/boutique/page", useSearchParams: () => new URLSearchParams() }));

const props = (over: Partial<BoutiqueHubProps> = {}): BoutiqueHubProps => ({
  locale: "en",
  shopId: "s1",
  allowed: ["page", "languages", "team", "invoices", "shops"],
  current: { section: "page", tab: "identity" },
  shop: { name: "Pattes de Saint-Henri", published: true, publicUrl: "https://www.akinaza.com/en/s/pattes-de-saint-henri" },
  children: <p>the section</p>,
  ...over,
});
const render = (p: BoutiqueHubProps, locale: "en" | "fr" = "en") => renderIn(locale, "pets", <BoutiqueHub {...p} />);
const text = (h: string) => h.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");

describe("Boutique, the shop's hub on SettingsLayout (K4)", () => {
  it("names the screen « Boutique » in its one h1, with the shop, its status and its public address (D6)", () => {
    const html = render(props());
    expect(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/g)?.map((h) => text(h).trim())).toEqual(["Shop"]);
    expect(text(render(props(), "fr")).match(/Boutique/)).not.toBeNull();
    expect(text(html)).toContain("Pattes de Saint-Henri");
    expect(text(html)).toContain("Published");
    expect(html).toContain("https://www.akinaza.com/en/s/pattes-de-saint-henri");
  });

  it("lets the address wrap on a 360 px phone instead of pushing the page wider", () => {
    const html = render(props());
    expect(html).toMatch(/class="[^"]*break-all[^"]*"[^>]*>https:\/\/www\.akinaza\.com/);
  });

  it("gathers the sections in groups, each one an address, and marks the open one", () => {
    const html = render(props());
    expect(text(html)).toContain("Your page");
    expect(text(html)).toContain("Your activity");
    expect(html).toContain('href="/en/app/s1/boutique/page?tab=identity"');
    expect(html).toContain('href="/en/app/s1/boutique/team"');
    expect(html).toContain('href="/en/app/s1/boutique/languages"');
    expect(html).toContain('href="/en/app/s1/boutique/invoices"');
    expect(html).toContain('href="/en/app/s1/boutique/shops"');
    expect(html).toMatch(/aria-current="(page|true)"/);
  });

  it("shows a manager the team and nothing of the shop's own settings", () => {
    const html = render(props({ allowed: ["team"], current: { section: "team" } }));
    expect(html).toContain('href="/en/app/s1/boutique/team"');
    expect(html).not.toContain("boutique/invoices");
    expect(html).not.toContain("boutique/page");
  });

  it("is one menu on a phone past five sections, as SettingsLayout draws it", () => {
    expect(render(props())).toContain("<details");
  });

  it("speaks French", () => {
    const t = text(render(props({ current: { section: "invoices" } }), "fr"));
    for (const word of ["Votre page", "Votre activité", "Courriels de facture", "Publiée"]) expect(t).toContain(word);
  });
});
