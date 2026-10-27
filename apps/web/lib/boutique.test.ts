import { describe, expect, it } from "vitest";

import { BOUTIQUE_NEEDS, BOUTIQUE_SECTIONS, boutiqueGroups, type BoutiqueNavWords,boutiqueSectionsAllowed, firstBoutiqueSection, isBoutiqueSection, isPageTab, PAGE_TAB_NEEDS, PAGE_TABS, pageTabsAllowed } from "./boutique";
import { may } from "./member-shop";

const WORDS: BoutiqueNavWords = {
  groups: { page: "Your page", business: "Your activity" },
  tabs: { identity: "Identity", texts: "Your page text", contact: "Contact", offer: "Offer", media: "Photos", composer: "Layout", look: "Look", wall: "Wall", reels: "Video", board: "Board", reviews: "Reviews", publish: "Publish" },
  languages: "Languages",
  team: "Team",
  invoices: "Invoice e-mails",
  agenda: "Calendar",
  figures: "Figure thresholds",
  shops: "Your shops",
};
const href = (section: string, tab?: string) => `/en/app/s-1/boutique/${section}${tab ? `?tab=${tab}` : ""}`;
const tabsFor = (role: "owner" | "manager" | "staff") => pageTabsAllowed((permission) => may(role, permission));
const allowedFor = (role: "owner" | "manager" | "staff") => boutiqueSectionsAllowed((permission) => may(role, permission));

describe("Boutique, the hub of the shop's configuration (K4)", () => {
  it("holds the sections of the shop page and the shop as a place", () => {
    expect(PAGE_TABS).toEqual(["identity", "texts", "contact", "offer", "media", "composer", "look", "wall", "reels", "board", "reviews", "publish"]);
    expect(BOUTIQUE_SECTIONS).toEqual(["page", "languages", "team", "invoices", "agenda", "figures", "shops"]);
  });

  it("reads what a role may open from the role table (packages/db/src/roles.ts), never from a role name", () => {
    expect(BOUTIQUE_NEEDS).toEqual({ page: "catalogue", languages: "settings", team: "team", invoices: "settings", agenda: "bookings", figures: "settings", shops: "settings" });
    expect(allowedFor("owner")).toEqual(["page", "languages", "team", "invoices", "agenda", "figures", "shops"]);
    expect(allowedFor("manager")).toEqual(["page", "team", "agenda"]);
    expect(tabsFor("manager")).toEqual(["composer", "wall", "reels", "board", "reviews"]);
    expect(tabsFor("owner")).toEqual([...PAGE_TABS]);
    expect(tabsFor("staff")).toEqual([]);
    expect(allowedFor("staff")).toEqual([]);
  });

  it("opens the first section the role may open, and no section for a role with none", () => {
    expect(firstBoutiqueSection(allowedFor("owner"))).toBe("page");
    expect(firstBoutiqueSection(allowedFor("manager"))).toBe("page");
    expect(firstBoutiqueSection(allowedFor("staff"))).toBeNull();
  });

  it("recognises a section and a tab of the page, and nothing else", () => {
    expect(isBoutiqueSection("team")).toBe(true);
    expect(isBoutiqueSection("shop")).toBe(false);
    expect(isPageTab("look")).toBe(true);
    expect(isPageTab("apparence")).toBe(false);
    expect(isPageTab(undefined)).toBe(false);
  });

  it("groups the owner's navigation: the page and its languages, then the team, the invoice e-mails and the shops", () => {
    const groups = boutiqueGroups({ allowed: allowedFor("owner"), href, current: { section: "page", tab: "contact" }, words: WORDS });
    expect(groups.map((g) => g.id)).toEqual(["page", "business"]);
    expect(groups[0]!.items.map((i) => i.id)).toEqual(["page-identity", "page-texts", "page-contact", "page-offer", "page-media", "page-composer", "page-look", "page-wall", "page-reels", "page-board", "page-reviews", "page-publish", "languages"]);
    expect(groups[1]!.items.map((i) => i.id)).toEqual(["team", "invoices", "agenda", "figures", "shops"]);
  });

  it("marks the open section and its tab, and gives each item its address", () => {
    const groups = boutiqueGroups({ allowed: allowedFor("owner"), href, current: { section: "page", tab: "contact" }, words: WORDS });
    const current = groups.flatMap((g) => g.items).filter((i) => i.current).map((i) => i.id);
    expect(current).toEqual(["page-contact"]);
    expect(groups[0]!.items[2]!.href).toBe("/en/app/s-1/boutique/page?tab=contact");
    expect(groups[1]!.items[0]!.href).toBe("/en/app/s-1/boutique/team");
  });

  it("shows a manager what is pinned on the page and the team, and a staff member no group at all", () => {
    const manager = boutiqueGroups({ allowed: allowedFor("manager"), tabs: tabsFor("manager"), href, current: { section: "team" }, words: WORDS });
    expect(manager.map((g) => g.items.map((i) => i.id))).toEqual([["page-composer", "page-wall", "page-reels", "page-board", "page-reviews"], ["team", "agenda"]]);
    expect(manager[1]!.items[0]!.current).toBe(true);
    expect(boutiqueGroups({ allowed: allowedFor("staff"), href, current: { section: "team" }, words: WORDS })).toEqual([]);
  });
});

describe("the layout tab (akinaza#402)", () => {
  it("is for the roles that write the page, not for staff", () => {
    expect(PAGE_TAB_NEEDS.composer).toBe("catalogue");
    expect(pageTabsAllowed((permission) => permission !== "catalogue" && permission !== "settings")).not.toContain("composer");
    expect(pageTabsAllowed(() => true)).toContain("composer");
  });
});
