import { translationRows, translationRunsOn } from "@akinaza/db";
import type { Metadata } from "next";

import { type LanguagesData, ShopLanguages } from "@/components/app/ShopLanguages";
import { db } from "@/lib/db";
import { asLocale, getDictionary } from "@/lib/i18n";
import { memberShop } from "@/lib/member-shop";
import { shopRoutes } from "@/lib/routes";
import { translationRules } from "@/lib/translation-settings";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.shopLanguages.title };
}

/** The shop page in other languages: the languages on, each text in each of them (#258). The owner only. */
export default async function ShopLanguagesPage({ params }: { params: Promise<{ locale: string; shop: string }> }) {
  const { locale: rawLocale, shop: shopId } = await params;
  const locale = asLocale(rawLocale);
  const { shop } = await memberShop(shopId, "settings");
  const [rows, rules, used] = await Promise.all([translationRows(db(), shop.id), translationRules(), translationRunsOn(db(), shop.id, new Date().toISOString().slice(0, 10))]);
  const data: LanguagesData = { source: rows.source as "fr" | "en", enabled: rows.enabled, allowed: rules.allowed, translationOn: rules.enabled, dailyLimit: rules.dailyLimit, usedToday: used, fields: rows.fields, setupHref: shopRoutes(locale, shop.id).setup };
  return <ShopLanguages data={data} />;
}
