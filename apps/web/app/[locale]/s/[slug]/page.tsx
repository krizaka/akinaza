
import { teamDay } from "@akinaza/db";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { Storefront } from "@/components/shop/Storefront";
import { StorefrontLive } from "@/components/shop/StorefrontLive";
import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { db } from "@/lib/db";
import { proposedDefaults } from "@/lib/default-media-settings";
import { asLocale, asPageLocale, getDictionary, uiLocaleOf } from "@/lib/i18n";
import { appSettings, shopSectionFeatures } from "@/lib/settings";
import { loadPublicShop, loadPublicShopOrMove } from "@/lib/shop-page";
import { buildStorefront } from "@/lib/storefront";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = await loadPublicShop(slug);
  const l = asLocale(locale);
  const content = asPageLocale(locale);
  const tagline = page ? buildStorefront({ page, locale: uiLocaleOf(content), contentLocale: content, now: new Date() }).tagline : null;
  // Each language the owner offers is an alternate of the others (the page itself stays out of search engines for now).
  const languages = page ? Object.fromEntries(page.languages.enabled.map((x) => [x, `/${x}/s/${slug}`])) : undefined;
  return { title: page?.shop.name ?? getDictionary(l).console.shopPage.notFound, description: tagline ?? undefined, alternates: languages ? { canonical: `/${content}/s/${slug}`, languages } : undefined, robots: { index: false, follow: false } };
}

/** A shop's public page: the cover, the services as cards, the next free times (the real availability), the hours, the areas on a map, who you will meet, the way in. */
export default async function ShopPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: raw, slug } = await params;
  const content = asPageLocale(raw);
  const locale = uiLocaleOf(content);
  const page = await loadPublicShopOrMove(content, slug);
  if (!page) notFound();
  // A language the owner has not turned on is the source language (the address of a language that is off never 404s, never shows a half page).
  if (!page.languages.enabled.includes(content)) redirect(`/${page.languages.source}/s/${slug}`);
  const now = new Date();
  // Who is here today, computed on the server from bare time ranges: the page receives a state per first name, nothing else.
  const [team, enabledUpcomingSections] = await Promise.all([teamDay(db(), page.shop.id, now), shopSectionFeatures()]);
  const view = buildStorefront({ page, locale, contentLocale: content, now, teamDay: team, enabledUpcomingSections, defaults: await proposedDefaults(page) });
  return (
    <>
      <SiteHeader locale={locale} current="home" path={`/${content}/s/${slug}`} languages={page.languages.enabled} contentLocale={content} />
      <StorefrontLive slug={slug} enabled={await appSettings().get("realtime.storefront.enabled")} />
      <Storefront view={view} locale={locale} />
      <SiteFooter locale={locale} />
    </>
  );
}
