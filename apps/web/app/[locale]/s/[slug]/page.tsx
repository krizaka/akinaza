import { slugSchema } from "@akinaza/core";
import { listSlots, publicShop } from "@akinaza/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Storefront } from "@/components/shop/Storefront";
import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { searchValue } from "@/lib/booking-defaults";
import { db } from "@/lib/db";
import { asLocale, getDictionary, otherLocale } from "@/lib/i18n";
import { buildStorefront, resolveSelection } from "@/lib/storefront";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  const parsed = slugSchema.safeParse(slug);
  return parsed.success ? publicShop(db(), parsed.data) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = await load(slug);
  const l = asLocale(locale);
  return { title: page?.shop.name ?? getDictionary(l).console.shopPage.notFound, description: (l === "fr" ? page?.shop.taglineFr : page?.shop.taglineEn) ?? undefined, robots: { index: false, follow: false } };
}

/** A shop's public page: the cover, the services as cards, the next free times (the real availability), the hours, the areas on a map, who you will meet, the way in. */
export default async function ShopPage({ params, searchParams }: { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale: raw, slug } = await params;
  const query = await searchParams;
  const locale = asLocale(raw);
  const page = await load(slug);
  if (!page) notFound();
  const now = new Date();
  const selection = { service: searchValue(query.service), zone: searchValue(query.zone) };
  const chosen = resolveSelection(page, selection);
  const slots = chosen.serviceId ? await listSlots(db(), { shopId: page.shop.id, serviceId: chosen.serviceId, zoneId: chosen.zoneId, now, days: 14 }) : [];
  const view = buildStorefront({ page, locale, now, selection, slots });
  return (
    <>
      <SiteHeader locale={locale} current="home" switchHref={`/${otherLocale(locale)}/s/${slug}`} />
      <Storefront view={view} locale={locale} />
      <SiteFooter locale={locale} />
    </>
  );
}
