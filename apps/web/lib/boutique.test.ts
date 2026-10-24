import { describe, expect, it } from "vitest";

import { BOUTIQUE_NEEDS, BOUTIQUE_SECTIONS, boutiqueGroups, type BoutiqueNavWords,boutiqueSectionsAllowed, firstBoutiqueSection, isBoutiqueSection, isPageTab, PAGE_TABS } from "./boutique";
import { may } from "./member-shop";

const WORDS: BoutiqueNavWords = {
  groups: { page: "Your page", business: "Your activity" },
  tabs: { identity: "Identity", texts: "Your page text", contact: "Contact", offer: "Offer", media: "Photos", look: "Look", publish: "Publish" },
  languages: "Languages",
  team: "Team",
  invoices: "Invoice e-mails",
  shops: "Your shops",
};
const href = (section: string, tab?: string) => `/en/app/s-1/boutique/${section}${tab ? `?tab=${tab}` : ""}`;
const allowedFor = (role: "owner" | "manager" | "staff") => boutiqueSectionsAllowed((permission) => may(role, permission));

describe("Boutique, the hub of the shop's configuration (K4)", () => {
  it("holds the seven sections of the shop page and nothing that is still being prepared", () => {
    expect(PAGE_TABS).toEqual(["identity", "texts", "contact", "offer", "media", "look", "publish"]);
    expect(BOUTIQUE_SECTIONS).toEqual(["page", "languages", "team", "invoices", "shops"]);
  });

  it("reads what a role may open from the role table (packages/db/src/roles.ts), never from a role name", () => {
    expect(BOUTIQUE_NEEDS).toEqual({ page: "settings", languages: "settings", team: "team", invoices: "settings", shops: "settings" });
    expect(allowedFor("owner")).toEqual(["page", "languages", "team", "invoices", "shops"]);
    expect(allowedFor("manager")).toEqual(["team"]);
    expect(allowedFor("staff")).toEqual([]);
  });

  it("opens the first section the role may open, and no section for a role with none", () => {
    expect(firstBoutiqueSection(allowedFor("owner"))).toBe("page");
    expect(firstBoutiqueSection(allowedFor("manager"))).toBe("team");
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
    expect(groups[0]!.items.map((i) => i.id)).toEqual(["page-identity", "page-texts", "page-contact", "page-offer", "page-media", "page-look", "page-publish", "languages"]);
    expect(groups[1]!.items.map((i) => i.id)).toEqual(["team", "invoices", "shops"]);
  });

  it("marks the open section and its tab, and gives each item its address", () => {
    const groups = boutiqueGroups({ allowed: allowedFor("owner"), href, current: { section: "page", tab: "contact" }, words: WORDS });
    const current = groups.flatMap((g) => g.items).filter((i) => i.current).map((i) => i.id);
    expect(current).toEqual(["page-contact"]);
    expect(groups[0]!.items[2]!.href).toBe("/en/app/s-1/boutique/page?tab=contact");
    expect(groups[1]!.items[0]!.href).toBe("/en/app/s-1/boutique/team");
  });

  it("shows a manager the team alone, and a staff member no group at all", () => {
    const manager = boutiqueGroups({ allowed: allowedFor("manager"), href, current: { section: "team" }, words: WORDS });
    expect(manager.map((g) => g.items.map((i) => i.id))).toEqual([["team"]]);
    expect(manager[0]!.items[0]!.current).toBe(true);
    expect(boutiqueGroups({ allowed: allowedFor("staff"), href, current: { section: "team" }, words: WORDS })).toEqual([]);
  });
});
