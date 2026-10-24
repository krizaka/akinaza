import { notFound, permanentRedirect } from "next/navigation";

import { asLocale } from "@/lib/i18n";
import { shopRoutes } from "@/lib/routes";
import { isShopId } from "@/lib/shop-id";

/** The languages moved into Boutique (K4): the old address opens Boutique › Langues. */
export default async function ShopLanguagesMoved({ params }: { params: Promise<{ locale: string; shop: string }> }) {
  const { locale, shop } = await params;
  if (!isShopId(shop)) notFound();
  permanentRedirect(shopRoutes(asLocale(locale), shop).boutique("languages"));
}
