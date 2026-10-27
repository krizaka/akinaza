import type { ShopPermission } from "@akinaza/db";
import type { SettingsNavGroup } from "@krizaka/ui/settings-layout";

/**
 * Boutique (K4, docs/ux/2026-10-full-review.md § 4.1 and the errata): everything that configures the shop, one hub on
 * `SettingsLayout`. The sections are data; what a role may open is `packages/db/src/roles.ts` (`BOUTIQUE_NEEDS`), never an
 * `if` on a role name. Pure: no database, no request, so the client hub and the server pages read the same table.
 */

/** The sections of « Ma page boutique » (#265, #266) and the shop as a place (B45: the wall, the video and profiles, the board, the reviews), each one save of its own. */
export const PAGE_TABS = ["identity", "texts", "contact", "offer", "media", "look", "wall", "reels", "board", "reviews", "publish"] as const;
export type PageTab = (typeof PAGE_TABS)[number];

/** The permission each tab takes: the shop's identity and publication are the owner's (`settings`); what is pinned on the page is the owner's and the manager's (`catalogue`, #180). */
export const PAGE_TAB_NEEDS: Record<PageTab, ShopPermission> = { identity: "settings", texts: "settings", contact: "settings", offer: "settings", media: "settings", look: "settings", wall: "catalogue", reels: "catalogue", board: "catalogue", reviews: "catalogue", publish: "settings" };

/** The tabs a role may open, in the hub's order. */
export const pageTabsAllowed = (allows: (permission: ShopPermission) => boolean): PageTab[] => PAGE_TABS.filter((tab) => allows(PAGE_TAB_NEEDS[tab]));

export const BOUTIQUE_SECTIONS = ["page", "languages", "team", "invoices", "figures", "shops"] as const;
export type BoutiqueSection = (typeof BOUTIQUE_SECTIONS)[number];

export const isBoutiqueSection = (value: string): value is BoutiqueSection => (BOUTIQUE_SECTIONS as readonly string[]).includes(value);
export const isPageTab = (value: string | undefined): value is PageTab => (PAGE_TABS as readonly string[]).includes(value ?? "");

/** The permission each section takes (the role table decides who holds it). The team is the manager's; the shop's settings are the owner's. */
export const BOUTIQUE_NEEDS: Record<BoutiqueSection, ShopPermission> = { page: "catalogue", languages: "settings", team: "team", invoices: "settings", figures: "settings", shops: "settings" };

/** The sections a role may open, in the hub's order. A staff member opens none: the rail does not offer Boutique to them. */
export function boutiqueSectionsAllowed(allows: (permission: ShopPermission) => boolean): BoutiqueSection[] {
  return BOUTIQUE_SECTIONS.filter((section) => allows(BOUTIQUE_NEEDS[section]));
}

/** The address a role lands on when it opens Boutique: its first section, or nothing. */
export const firstBoutiqueSection = (allowed: readonly BoutiqueSection[]): BoutiqueSection | null => allowed[0] ?? null;

export interface BoutiqueNavWords {
  groups: { page: string; business: string };
  tabs: Record<PageTab, string>;
  languages: string;
  team: string;
  invoices: string;
  figures: string;
  shops: string;
}

/**
 * The hub's navigation: « Votre page » (the seven sections and the languages) and « Votre activité » (the team, the invoice e-mails,
 * the shops). Only what the role may open; a group with nothing in it is not drawn.
 */
export function boutiqueGroups({ allowed, tabs = PAGE_TABS, href, current, words }: { allowed: readonly BoutiqueSection[]; /** The tabs of the page the role may open (all by default). */ tabs?: readonly PageTab[]; href: (section: BoutiqueSection, tab?: PageTab) => string; current: { section: BoutiqueSection; tab?: PageTab }; words: BoutiqueNavWords }): SettingsNavGroup[] {
  const has = (section: BoutiqueSection) => allowed.includes(section);
  const page = [
    ...(has("page") ? PAGE_TABS.filter((tab) => tabs.includes(tab)).map((tab) => ({ id: `page-${tab}`, label: words.tabs[tab], href: href("page", tab), current: current.section === "page" && (current.tab ?? "identity") === tab })) : []),
    ...(has("languages") ? [{ id: "languages", label: words.languages, href: href("languages"), current: current.section === "languages" }] : []),
  ];
  const business = [
    ...(has("team") ? [{ id: "team", label: words.team, href: href("team"), current: current.section === "team" }] : []),
    ...(has("invoices") ? [{ id: "invoices", label: words.invoices, href: href("invoices"), current: current.section === "invoices" }] : []),
    ...(has("figures") ? [{ id: "figures", label: words.figures, href: href("figures"), current: current.section === "figures" }] : []),
    ...(has("shops") ? [{ id: "shops", label: words.shops, href: href("shops"), current: current.section === "shops" }] : []),
  ];
  return [
    { id: "page", label: words.groups.page, items: page },
    { id: "business", label: words.groups.business, items: business },
  ].filter((group) => group.items.length > 0);
}
