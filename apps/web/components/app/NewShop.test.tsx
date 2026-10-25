import { SHOP_TYPES } from "@akinaza/core";
import { describe, expect, it, vi } from "vitest";

import { templateChoicesByTrade } from "@/lib/template-choices";
import { renderIn } from "@/lib/test-i18n";

import { NewShop } from "./NewShop";

vi.mock("@/app/actions/remember-shop", () => ({ rememberShop: () => Promise.resolve() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, replace: () => undefined, push: () => undefined }), usePathname: () => "/en/app/s1/shop/new", useSearchParams: () => new URLSearchParams() }));

const offers = templateChoicesByTrade({ enabled: true, offered: ["consulting-carte", "consulting-histoire", "salon-vitrine", "salon-carte", "pets-histoire", "pets-vitrine", "coaching-vitrine", "coaching-histoire", "workshop-histoire", "workshop-carte", "cleaning-vitrine", "cleaning-carte"], defaults: { salon: "salon-carte", coaching: "coaching-vitrine", workshop: "workshop-histoire", cleaning: "cleaning-vitrine", pets: "pets-histoire", consulting: "consulting-histoire" } }, SHOP_TYPES);
const text = (h: string) => h.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");
const checked = (html: string, name: string) => html.split("aria-checked=").find((seg) => seg.includes(`>${name}<`))?.startsWith('"true"');

describe("« Add a shop » with the templates offered (#261, step 4)", () => {
  it("asks the trade in place of the business type, and preselects the administrator's default template for it, beside a plain page", () => {
    const html = renderIn("en", "professional", <NewShop locale="en" backHref="/en/app/s1/shop" offers={offers} />);
    const t = text(html);
    expect(t).toContain("Your trade");
    for (const trade of ["Professional services", "Salon (hair, beauty)", "Pet care"]) expect(t).toContain(trade);
    expect(html).not.toContain('name="businessType"');
    expect(t).toContain("Page template");
    expect(t).toContain("Plain page");
    expect(t).toContain("Suggested");
    expect(checked(html, "My work")).toBe(true); // consulting-histoire, the administrator's default for the trade
    expect(checked(html, "Plain page")).toBe(false);
    expect(t).toContain("Create the shop");
  });

  it("without templates offered, the form is as before: the business type, no template", () => {
    const html = renderIn("en", "professional", <NewShop locale="en" backHref="/en/app/s1/shop" offers={null} />);
    expect(html).toContain('name="businessType"');
    expect(text(html)).not.toContain("Page template");
    expect(text(html)).not.toContain("Your trade");
  });

  it("speaks French", () => {
    const t = text(renderIn("fr", "professional", <NewShop locale="fr" backHref="/fr/app/s1/shop" offers={offers} />));
    for (const word of ["Votre métier", "Modèle de page", "Page simple", "Suggéré", "Créer la boutique"]) expect(t).toContain(word);
  });
});
