import { localDay } from "@akinaza/core";
import { communityOf, draftShopPage, ownerOfShop, previewShop, shopAccentOf, shopPaperOf, teamDay } from "@akinaza/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PreviewBridge } from "@/components/boutique/PreviewBridge";
import { ShopPageView } from "@/components/shop/ShopPageView";
import { pageSession } from "@/lib/access";
import { reviewRules } from "@/lib/community";
import { buildCommunity } from "@/lib/community-view";
import { db } from "@/lib/db";
import { proposedDefaults } from "@/lib/default-media-settings";
import { asPageLocale, uiLocaleOf } from "@/lib/i18n";
import { may, memberOf } from "@/lib/member-shop";
import { shopPaperShown, shopSectionFeatures } from "@/lib/settings";
import { buildStorefront } from "@/lib/storefront";

export const dynamic = "force-dynamic";

/** Never indexed, never cached: it is the owner's draft. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * The owner's preview of the DRAFT page (akinaza#402), the page of the composer's iframe. The public route reads the published document only; this
 * one reads the draft, for a member who may edit the page (no session or another shop's: a 404). Same view as the public page, same sections.
 */
export default async function ShopPreview({ params }: Readonly<{ params: Promise<{ locale: string; shop: string }> }>) {
  const { locale: raw, shop: shopId } = await params;
  const session = await pageSession();
  const member = session ? await memberOf(session.account.id, shopId) : null;
  if (!member || !may(member.role, "catalogue")) notFound();
  const page = await previewShop(db(), shopId);
  if (!page) notFound();
  const content = asPageLocale(raw);
  const locale = uiLocaleOf(content);
  const now = new Date();
  const [team, enabledUpcomingSections, community, rules, document, accent, paper] = await Promise.all([teamDay(db(), shopId, now), shopSectionFeatures(), communityOf(db(), shopId), reviewRules(), draftShopPage(db(), shopId), shopAccentOf(db(), shopId), shopPaperOf(db(), shopId).then(async (paper) => shopPaperShown(paper, await ownerOfShop(db(), shopId)))]);
  const placed = buildCommunity({ community, locale, today: localDay(now, page.shop.timezone), rules, enabled: enabledUpcomingSections });
  const view = buildStorefront({ page, locale, contentLocale: content, now, teamDay: team, enabledUpcomingSections, community: placed, defaults: await proposedDefaults(page) });
  return (
    <main id="content">
      <PreviewBridge />
      <ShopPageView page={document.page} view={view} locale={locale} accent={accent ?? undefined} paper={paper} today={localDay(now, page.shop.timezone)} />
    </main>
  );
}
