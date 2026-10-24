import { KrizakaQueryProvider } from "@krizaka/query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ShopFrame, type ShopFrameProps } from "./ShopFrame";

const where = vi.hoisted(() => ({ path: "/fr/app/s-1/aujourdhui" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => where.path }));
vi.mock("@/app/actions/remember-shop", () => ({ rememberShop: () => Promise.resolve() }));
vi.mock("@/lib/i18n-client", () => ({ useSay: () => ({ say: (key: string, vars?: Record<string, string>) => (vars ? `${key} ${Object.values(vars).join(" ")}` : key), locale: "fr" }) }));

const shop = "/fr/app/s-1";
const OWNER: ShopFrameProps = {
  locale: "fr",
  account: { email: "lea@example.test", name: "Léa" },
  places: [
    { key: "today", href: `${shop}/aujourdhui` },
    { key: "clients", href: `${shop}/clients` },
    { key: "invoices", href: `${shop}/invoices` },
    { key: "books", href: `${shop}/books` },
    { key: "shop", href: `${shop}/shop` },
  ],
  shop: { current: { id: "s-1", name: "Pattes de Saint-Henri" }, others: [], addHref: `${shop}/shop/new` },
  newInvoiceHref: `${shop}/invoices/new`,
  dev: true,
  home: "/fr/app",
  profileHref: "/fr/app/profile",
  children: <p>page</p>,
};
const render = (props: ShopFrameProps) => renderToStaticMarkup(<KrizakaQueryProvider><ShopFrame {...props} /></KrizakaQueryProvider>);
const railItems = (html: string) => html.match(/<a[^>]*data-rail-item[^>]*>/g) ?? [];

describe("the owner's frame (docs/ux/2026-10-full-review.md § 4.1): where you work on the rail, who you are under the avatar", () => {
  const html = render(OWNER);

  it("has the five destinations on the rail, the day marked as the current one, and nothing about the account there", () => {
    const items = railItems(html);
    expect(items).toHaveLength(5);
    expect(items.map((a) => a.match(/aria-label="([^"]+)"/)![1])).toEqual(["shell.today", "shell.clients", "shell.invoices", "shell.books", "shell.shop"]);
    expect(items[0]).toContain('aria-current="page"');
    expect(html).not.toContain("shell.profile");
    expect(html).not.toContain("shell.team");
  });

  it("names the product and the shop in the header, with the DEV chip of a deployment kept out of search engines", () => {
    const chip = html.match(/<[^>]*data-testid="shop-chip"[^>]*>[\s\S]*?Pattes de Saint-Henri/);
    expect(chip).not.toBeNull();
    expect(html).toContain(">Akinaza<");
    expect(html).toMatch(/data-testid="app-version"[^>]*>shell\.dev</);
  });

  it("carries the one primary action, « Nouvelle facture », and the account menu in the header, once, at every width", () => {
    expect(html.match(/data-testid="primary-action"/g)).toHaveLength(1);
    expect(html).toMatch(/data-testid="primary-action"[^>]*>[\s\S]*?shell\.newInvoice/);
    expect(html.match(/aria-label="shell\.account"/g)).toHaveLength(1);
    expect(html.indexOf('data-testid="account-menu-header"')).toBeLessThan(html.indexOf('aria-label="shell.account"'));
  });

  it("keeps the rail's « Boutique » current on the team screen, which is a sibling route of the shop's setup", () => {
    where.path = "/fr/app/s-1/team";
    try {
      const items = railItems(render({ ...OWNER, places: [...OWNER.places.slice(0, 4), { key: "shop", href: `${shop}/shop`, also: [`${shop}/team`] }] }));
      expect(items[4]).toContain('aria-current="page"');
      expect(items[0]).not.toContain('aria-current="page"');
    } finally {
      where.path = "/fr/app/s-1/aujourdhui";
    }
  });

  it("yields the header's « Nouvelle facture » on the invoice forms, which carry their own primary submit", () => {
    for (const path of ["/fr/app/s-1/invoices/new", "/fr/app/s-1/invoices/0b1c-2d3e/correct"]) {
      where.path = path;
      try {
        expect(render(OWNER)).not.toContain('data-testid="primary-action"');
      } finally {
        where.path = "/fr/app/s-1/aujourdhui";
      }
    }
    expect(render(OWNER)).toContain('data-testid="primary-action"');
  });

  it("leaves the page's h1 to the page: the frame renders none", () => {
    expect(html).not.toMatch(/<h1[\s>]/);
    expect(html).toContain('<main id="content"');
  });
});

describe("the same frame for other roles and for a client", () => {
  it("shows no primary action to a staff member, whose rail is the day alone", () => {
    const html = render({ ...OWNER, places: [{ key: "today", href: `${shop}/aujourdhui` }], newInvoiceHref: null, shop: { current: { id: "s-1", name: "Pattes de Saint-Henri" }, others: [], addHref: null } });
    expect(railItems(html)).toHaveLength(1);
    expect(html).not.toContain('data-testid="primary-action"');
    expect(html).toMatch(/data-testid="shop-chip"[^>]*>Pattes de Saint-Henri</);
  });

  it("gives a client their bookings and the account menu, no shop chip, no invoice", () => {
    const html = render({ ...OWNER, places: [{ key: "bookings", href: "/fr/app" }], shop: undefined, newInvoiceHref: null, dev: false });
    expect(railItems(html).map((a) => a.match(/aria-label="([^"]+)"/)![1])).toEqual(["shell.bookings"]);
    expect(html).not.toContain("shop-chip");
    expect(html).not.toContain("primary-action");
    expect(html).not.toContain("app-version");
    expect(html.match(/aria-label="shell\.account"/g)).toHaveLength(1);
  });
});

describe("the account under the avatar (docs/ux/2026-10-full-review.md K6)", () => {
  const trigger = (html: string) => html.match(/<button[^>]*aria-label="shell\.account"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";

  it("shows the name in the header once the person has set it", () => {
    expect(trigger(render(OWNER))).toContain("Léa");
  });

  it("prints no e-mail in the header while there is no name", () => {
    const html = render({ ...OWNER, account: { id: "a-1", email: "lea@example.test", name: null } });
    expect(trigger(html)).not.toBe("");
    expect(html).not.toContain("lea@example.test");
  });

  it("draws the same default picture as the profile: the chosen tone, else the account's own", async () => {
    const { avatarOf } = await import("@/lib/avatar");
    expect(avatarOf({ id: "a-1", avatarSeed: "4" })).toEqual({ brand: "akinaza", tone: 4 });
    expect(avatarOf({ id: "a-1", avatarSeed: null })).toEqual({ brand: "akinaza", seed: "a-1" });
  });

  it("reaches the account through the menu only: « Mon compte » leads to the profile, the rail does not", () => {
    const html = render(OWNER);
    expect(railItems(html).some((a) => a.includes('href="/fr/app/profile"'))).toBe(false);
  });
});
