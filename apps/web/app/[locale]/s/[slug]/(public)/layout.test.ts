import { describe, expect, it, vi } from "vitest";

const shops = vi.hoisted(() => ({ published: new Set<string>(), former: new Map<string, string>() }));
vi.mock("@/lib/shop-page", () => ({
  loadPublicShop: async (slug: string) => (shops.published.has(slug) ? { shop: { name: slug } } : null),
  movedShopPath: async (locale: string, slug: string) => (shops.former.has(slug) ? `/${locale}/s/${shops.former.get(slug)}` : null),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import ShopLayout from "./layout";

const render = (slug: string) => ShopLayout({ children: "the page", params: Promise.resolve({ locale: "fr", slug }) });

describe("a shop's public address answers 404 with the status 404 (the audit found 200 on a shop that does not exist)", () => {
  it("is not found before anything streams when the address is neither a published shop nor a former one", async () => {
    await expect(render("boutique-inexistante")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("lets a published shop's page through", async () => {
    shops.published.add("cedre-ciseaux");
    await expect(render("cedre-ciseaux")).resolves.toBe("the page");
  });

  it("lets a former address through: the page itself moves it (308) with the rest of the path", async () => {
    shops.former.set("ancienne-adresse", "cedre-ciseaux");
    await expect(render("ancienne-adresse")).resolves.toBe("the page");
  });
});
