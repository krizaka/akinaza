"use client";

import { Badge } from "@krizaka/ui/badge";
import { SettingsLayout } from "@krizaka/ui/settings-layout";
import Link from "next/link";

import { PagePreview } from "@/components/boutique/PagePreview";
import { boutiqueGroups, type BoutiqueSection, PAGE_TABS, type PageTab } from "@/lib/boutique";
import { useSay } from "@/lib/i18n-client";
import { type RouteLocale, shopRoutes } from "@/lib/routes";

export interface BoutiqueHubProps {
  locale: RouteLocale;
  shopId: string;
  /** The sections the role may open (`BOUTIQUE_NEEDS`): the navigation shows these and nothing else. */
  allowed: BoutiqueSection[];
  current: { section: BoutiqueSection; tab?: PageTab };
  /** The tabs of the page the role may open (all when absent). */
  tabs?: readonly PageTab[];
  /** The live preview beside the section (the shop as a place), when it is one that changes the page. */
  preview?: { src: string };
  shop: { name: string; published: boolean; publicUrl: string | null };
  children: React.ReactNode;
}

/**
 * Boutique (K4): the shop's configuration on `SettingsLayout` — the shop's identity (name, status, public address) on top, the
 * sections beside the page (grouped; one menu on a phone). Each section is its own address; the page holds one section, one save.
 */
export function BoutiqueHub({ locale, shopId, allowed, tabs, preview, current, shop, children }: Readonly<BoutiqueHubProps>) {
  const { say } = useSay();
  const routes = shopRoutes(locale, shopId);
  const groups = boutiqueGroups({
    allowed,
    tabs,
    href: (section, tab) => routes.boutique(section, tab),
    current,
    words: {
      groups: { page: say("boutique.groups.page"), business: say("boutique.groups.business") },
      tabs: Object.fromEntries(PAGE_TABS.map((tab) => [tab, say(`shopSetup.sections.tabs.${tab}`)])) as Record<PageTab, string>,
      languages: say("boutique.sections.languages"),
      team: say("boutique.sections.team"),
      invoices: say("boutique.sections.invoices"),
      figures: say("boutique.sections.figures"),
      shops: say("boutique.sections.shops"),
    },
  });
  return (
    <SettingsLayout
      variant="card"
      navLabel={say("boutique.navLabel")}
      linkAs={Link}
      nav={groups}
      header={
        <header className="flex min-w-0 flex-col gap-2">
          <h1 className="text-2xl font-bold text-fg">{say("shell.shop")}</h1>
          <p className="break-words font-display text-xl font-bold text-fg">{shop.name}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Badge tone={shop.published ? "success" : "neutral"}>{say(shop.published ? "shopSetup.published" : "shopSetup.notPublished")}</Badge>
            {shop.publicUrl && shop.published ? <a className="font-semibold text-fg-accent underline" href={shop.publicUrl}>{say("shopSetup.viewPage")}</a> : null}
          </div>
          {shop.publicUrl ? <p className="break-all font-mono text-xs text-fg-muted">{shop.publicUrl}</p> : null}
        </header>
      }
    >
      {preview ? (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          <div className="min-w-0">{children}</div>
          <PagePreview src={preview.src} published={shop.published} />
        </div>
      ) : children}
    </SettingsLayout>
  );
}
