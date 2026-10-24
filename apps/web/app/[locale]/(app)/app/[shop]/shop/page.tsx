import { notFound, permanentRedirect } from "next/navigation";

import { asLocale } from "@/lib/i18n";
import { shopRoutes } from "@/lib/routes";
import { isShopId } from "@/lib/shop-id";

/** « Ma page boutique » moved into Boutique (K4): its old address opens Boutique › Page. */
export default async function ShopPageMoved({ params }: { params: Promise<{ locale: string; shop: string }> }) {
  const { locale, shop } = await params;
  if (!isShopId(shop)) notFound();
  permanentRedirect(shopRoutes(asLocale(locale), shop).setup);
}
