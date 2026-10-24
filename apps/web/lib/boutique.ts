import type { ShopPermission } from "@akinaza/db";
import type { SettingsNavGroup } from "@krizaka/ui/settings-layout";

/**
 * Boutique (K4, docs/ux/2026-10-full-review.md § 4.1 and the errata): everything that configures the shop, one hub on
 * `SettingsLayout`. The sections are data; what a role may open is `packages/db/src/roles.ts` (`BOUTIQUE_NEEDS`), never an
 * `if` on a role name. Pure: no database, no request, so the client hub and the server pages read the same table.
 */

/** The seven sections of « Ma page boutique » (#265, #266), each one save of its own. */
export const PAGE_TABS = ["identity", "texts", "contact", "offer", "media", "look", "publish"] as const;
export type PageTab = (typeof PAGE_TABS)[number];

export const BOUTIQUE_SECTIONS = ["page", "languages", "team", "invoices", "shops"] as const;
export type BoutiqueSection = (typeof BOUTIQUE_SECTIONS)[number];

export const isBoutiqueSection = (value: string): value is BoutiqueSection => (BOUTIQUE_SECTIONS as readonly string[]).includes(value);
export const isPageTab = (value: string | undefined): value is PageTab => (PAGE_TABS as readonly string[]).includes(value ?? "");

/** The permission each section takes (the role table decides who holds it). The team is the manager's; the shop's settings are the owner's. */
export const BOUTIQUE_NEEDS: Record<BoutiqueSection, ShopPermission> = { page: "settings", languages: "settings", team: "team", invoices: "settings", shops: "settings" };

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
  shops: string;
}

/**
 * The hub's navigation: « Votre page » (the seven sections and the languages) and « Votre activité » (the team, the invoice e-mails,
 * the shops). Only what the role may open; a group with nothing in it is not drawn.
 */
export function boutiqueGroups({ allowed, href, current, words }: { allowed: readonly BoutiqueSection[]; href: (section: BoutiqueSection, tab?: PageTab) => string; current: { section: BoutiqueSection; tab?: PageTab }; words: BoutiqueNavWords }): SettingsNavGroup[] {
  const has = (section: BoutiqueSection) => allowed.includes(section);
  const page = [
    ...(has("page") ? PAGE_TABS.map((tab) => ({ id: `page-${tab}`, label: words.tabs[tab], href: href("page", tab), current: current.section === "page" && (current.tab ?? "identity") === tab })) : []),
    ...(has("languages") ? [{ id: "languages", label: words.languages, href: href("languages"), current: current.section === "languages" }] : []),
  ];
  const business = [
    ...(has("team") ? [{ id: "team", label: words.team, href: href("team"), current: current.section === "team" }] : []),
    ...(has("invoices") ? [{ id: "invoices", label: words.invoices, href: href("invoices"), current: current.section === "invoices" }] : []),
    ...(has("shops") ? [{ id: "shops", label: words.shops, href: href("shops"), current: current.section === "shops" }] : []),
  ];
  return [
    { id: "page", label: words.groups.page, items: page },
    { id: "business", label: words.groups.business, items: business },
  ].filter((group) => group.items.length > 0);
}
