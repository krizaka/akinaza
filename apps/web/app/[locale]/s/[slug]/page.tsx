
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Storefront } from "@/components/shop/Storefront";
import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { asLocale, getDictionary } from "@/lib/i18n";
import { loadPublicShop } from "@/lib/shop-page";
import { buildStorefront } from "@/lib/storefront";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = await loadPublicShop(slug);
  const l = asLocale(locale);
  return { title: page?.shop.name ?? getDictionary(l).console.shopPage.notFound, description: (l === "fr" ? page?.shop.taglineFr : page?.shop.taglineEn) ?? undefined, robots: { index: false, follow: false } };
}

/** A shop's public page: the cover, the services as cards, the next free times (the real availability), the hours, the areas on a map, who you will meet, the way in. */
export default async function ShopPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: raw, slug } = await params;
  const locale = asLocale(raw);
  const page = await loadPublicShop(slug);
  if (!page) notFound();
  const now = new Date();
  const view = buildStorefront({ page, locale, now });
  return (
    <>
      <SiteHeader locale={locale} current="home" path={`/${locale}/s/${slug}`} />
      <Storefront view={view} locale={locale} />
      <SiteFooter locale={locale} />
    </>
  );
}
