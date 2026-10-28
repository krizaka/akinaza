import { describe, expect, it, vi } from "vitest";

const shops = vi.hoisted(() => ({ published: new Map<string, string[]>() }));
vi.mock("@/lib/shop-page", () => ({
  loadPublicShop: async (slug: string) => (shops.published.has(slug) ? { services: shops.published.get(slug)!.map((id) => ({ id })) } : null),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import ServiceLayout from "./layout";

const render = (slug: string, id: string) => ServiceLayout({ children: "the page", params: Promise.resolve({ slug, id }) });

describe("a service that does not exist answers 404 with the status 404 (akinaza#293)", () => {
  it("is not found before anything streams when the published shop has no such service", async () => {
    shops.published.set("cedre-ciseaux", ["svc-1"]);
    await expect(render("cedre-ciseaux", "x")).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("lets the shop's own service through", async () => {
    await expect(render("cedre-ciseaux", "svc-1")).resolves.toBe("the page");
  });
  it("lets a former shop address through: the page moves it (308)", async () => {
    await expect(render("ancienne", "svc-1")).resolves.toBe("the page");
  });
});
