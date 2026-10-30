
import { demoLookDocument, demoLooksOf, localDay } from "@akinaza/core";
import { communityOf, ownerOfShop, publishedShopPage, shopAccentOf, shopPaperOf, teamDay } from "@akinaza/db";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { DemoLookSwitch } from "@/components/shop/DemoLookSwitch";
import { ShopPageView } from "@/components/shop/ShopPageView";
import { StorefrontLive } from "@/components/shop/StorefrontLive";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { requestNow } from "@/app/request-now";
import { nextFreeTimeOf } from "@/lib/closing-call-read";
import { reviewRules } from "@/lib/community";
import { buildCommunity } from "@/lib/community-view";
import { db } from "@/lib/db";
import { proposedDefaults } from "@/lib/default-media-settings";
import { asLocale, asPageLocale, getDictionary, uiLocaleOf } from "@/lib/i18n";
import { SESSION_COOKIE } from "@/lib/session";
import { appSettings, shopPaperShown, shopSectionFeatures } from "@/lib/settings";
import { shopPageUrl } from "@/lib/shop-domain";
import { loadPublicShop, loadPublicShopOrMove } from "@/lib/shop-page";
import { buildStorefront } from "@/lib/storefront";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = await loadPublicShop(slug);
  const l = asLocale(locale);
  const content = asPageLocale(locale);
  const tagline = page ? buildStorefront({ page, locale: uiLocaleOf(content), contentLocale: content, now: requestNow() }).tagline : null;
  // Each language the owner offers is an alternate of the others (the page itself stays out of search engines for now).
  const languages = page ? Object.fromEntries(page.languages.enabled.map((x) => [x, shopPageUrl(slug, x, process.env)])) : undefined;
  return { title: page?.shop.name ?? getDictionary(l).console.shopPage.notFound, description: tagline ?? undefined, alternates: languages ? { canonical: shopPageUrl(slug, content, process.env), languages } : undefined, robots: { index: false, follow: false } };
}

/** A shop's public page: the cover, the services as cards, the next free times (the real availability), the hours, the areas on a map, who you will meet, the way in. */
export default async function ShopPage({ params, searchParams }: Readonly<{ params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ look?: string }> }>) {
  const { locale: raw, slug } = await params;
  const { look } = await searchParams;
  const content = asPageLocale(raw);
  const locale = uiLocaleOf(content);
  const page = await loadPublicShopOrMove(content, slug);
  if (!page) notFound();
  // A language the owner has not turned on is the source language (the address of a language that is off never 404s, never shows a half page).
  if (!page.languages.enabled.includes(content)) redirect(`/${page.languages.source}/s/${slug}`);
  const now = requestNow();
  // No session cookie: the bar is the signed-out one with no script for the session (the island asks `/api/me` only for someone who may be signed in).
  const anonymous = !(await cookies()).has(SESSION_COOKIE);
  const live = await appSettings().get("realtime.storefront.enabled");
  // Who is here today, computed on the server from bare time ranges: the page receives a state per first name, nothing else.
  const [team, enabledUpcomingSections, community, rules, document] = await Promise.all([teamDay(db(), page.shop.id, now), shopSectionFeatures(), communityOf(db(), page.shop.id), reviewRules(), publishedShopPage(db(), page.shop.id)]);
  const accent = (await shopAccentOf(db(), page.shop.id)) ?? undefined;
  const paper = await shopPaperShown(await shopPaperOf(db(), page.shop.id), await ownerOfShop(db(), page.shop.id));
  const placed = buildCommunity({ community, locale, today: localDay(now, page.shop.timezone), rules, enabled: enabledUpcomingSections });
  const view = buildStorefront({ page, locale, contentLocale: content, now, teamDay: team, enabledUpcomingSections, community: placed, defaults: await proposedDefaults(page) });
  // The demo shops offer the other compositions of Krizaka UI (`?look=`); any other shop ignores the parameter.
  const other = demoLookDocument(slug, look);
  const looks = demoLooksOf(slug);
  const shown = other ? looks.find((l) => l.id === look)!.id : looks[0]?.id ?? "";
  const shownPage = other ?? document.page;
  const nextTime = shownPage.sections.some((s) => s.type === "booking" && s.variant === "closing" && !s.disabled) ? await nextFreeTimeOf({ page, locale, now }) : undefined;
  return (
    <>
      <SiteHeader locale={locale} current="home" path={`/${content}/s/${slug}`} languages={page.languages.enabled} contentLocale={content} anonymous={anonymous} />
      {live ? <StorefrontLive slug={slug} enabled /> : null}
      <DemoLookSwitch slug={slug} current={shown} path={`/${content}/s/${slug}`} locale={locale} />
      <main id="content" data-shop-look={shown || undefined}><ShopPageView page={shownPage} view={view} locale={locale} nextTime={nextTime} accent={other ? undefined : accent} paper={other ? undefined : paper} today={localDay(now, page.shop.timezone)} /></main>
      <SiteFooter locale={locale} />
    </>
  );
}
