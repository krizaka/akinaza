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
  search: true,
  counts: { today: 3, toCollect: 2 },
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
    expect(items.map((a) => a.match(/aria-label="([^",]+)/)![1])).toEqual(["shell.today", "shell.clients", "shell.invoices", "shell.books", "shell.shop"]);
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

  it("carries the one primary action, « Nouvelle facture », on the lists, with the account menu in the header, once, at every width", () => {
    where.path = "/fr/app/s-1/invoices";
    try {
      const list = render(OWNER);
      expect(list.match(/data-primary/g)).toHaveLength(1);
      expect(list).toMatch(/data-testid="primary-action"[^>]*>[\s\S]*?shell\.newInvoice/);
      expect(list.match(/aria-label="shell\.account"/g)).toHaveLength(1);
      expect(list.indexOf('data-testid="account-menu-header"')).toBeLessThan(list.indexOf('aria-label="shell.account"'));
    } finally {
      where.path = "/fr/app/s-1/aujourdhui";
    }
  });

  it("yields « Nouvelle facture » on Aujourd'hui, whose primary is the next appointment (D1b)", () => {
    expect(html).not.toContain("data-primary");
    expect(html).not.toContain('data-testid="primary-action"');
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
    where.path = "/fr/app/s-1/clients";
    try {
      expect(render(OWNER)).toContain('data-testid="primary-action"');
    } finally {
      where.path = "/fr/app/s-1/aujourdhui";
    }
  });

  it("leaves the page's h1 to the page: the frame renders none", () => {
    expect(html).not.toMatch(/<h1[\s>]/);
    expect(html).toContain('<main id="content"');
  });
});

describe("the B2 frame (D1b): the search, the language, the rail with its words and its counts", () => {
  const html = render(OWNER);

  it("opens the search from the header, with its ⌘K hint and the shortcut said to assistive technology", () => {
    const trigger = html.match(/<button[^>]*data-testid="search-trigger"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
    expect(trigger).toContain('aria-label="shell.search.open"');
    expect(trigger).toContain('aria-keyshortcuts="Meta+K Control+K"');
    expect(trigger).toContain("<kbd");
    expect(trigger).toContain("shell.search.placeholder");
  });

  it("offers no search to who may open neither clients nor invoices", () => {
    expect(render({ ...OWNER, search: false })).not.toContain("search-trigger");
  });

  it("shows the language in the header from a tablet up (the account menu carries it on a phone)", () => {
    expect(html).toMatch(/class="hidden sm:block" data-testid="header-language"><div[\s\S]*?shell\.language/);
  });

  it("shows the rail's words on a desktop and counts on the day and the invoices, said in words", () => {
    expect(html).toContain("data-expanded");
    const items = railItems(html);
    expect(items[0]).toContain('aria-label="shell.today, shell.badges.today 3"');
    expect(items[2]).toContain('aria-label="shell.invoices, shell.badges.toCollect 2"');
    expect(items[1]).not.toContain("shell.badges");
  });

  it("draws no badge for a zero", () => {
    const items = railItems(render({ ...OWNER, counts: { today: 0, toCollect: 0 } }));
    expect(items.some((a) => a.includes("shell.badges"))).toBe(false);
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
