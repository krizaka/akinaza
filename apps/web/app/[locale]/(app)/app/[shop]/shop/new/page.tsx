import { SHOP_TYPES } from "@akinaza/core";
import type { Metadata } from "next";

import { NewShop } from "@/components/app/NewShop";
import { asLocale, getDictionary } from "@/lib/i18n";
import { memberShop } from "@/lib/member-shop";
import { shopRoutes } from "@/lib/routes";
import { templateChoicesByTrade } from "@/lib/template-choices";
import { templateCatalogue, templateRules } from "@/lib/template-rules";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.shopSetup.addShop.title };
}

/** « Add a shop »: one more shop for the account of the person working in this one. */
export default async function NewShopPage({ params }: { params: Promise<{ locale: string; shop: string }> }) {
  const { locale: raw, shop: shopId } = await params;
  const locale = asLocale(raw);
  const { session } = await memberShop(shopId, "settings");
  return <NewShop locale={locale} backHref={shopRoutes(locale, shopId).setup} offers={templateChoicesByTrade(await templateRules(), SHOP_TYPES, await templateCatalogue(session.account.id))} />;
}
