import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NewShop } from "@/components/app/NewShop";
import { pageSession } from "@/lib/access";
import { asLocale, getDictionary } from "@/lib/i18n";
import { lastMember } from "@/lib/member-shop";
import { accountRoutes, shopRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: getDictionary(asLocale((await params).locale)).console.shopSetup.openShop.title };
}

/**
 * « Ouvrir une boutique » (K7): a client's first shop, from their bookings. Someone who already works in a shop adds one from
 * the shop's own space (Boutique › Boutiques), so this address takes them there.
 */
export default async function OpenShopPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const { account } = (await pageSession())!;
  const member = await lastMember(account.id);
  if (member) redirect(shopRoutes(locale, member.shop.id).addShop);
  return <NewShop locale={locale} backHref={accountRoutes(locale).home} first />;
}
