import { notFound, permanentRedirect } from "next/navigation";

import { asLocale } from "@/lib/i18n";
import { shopRoutes } from "@/lib/routes";
import { isShopId } from "@/lib/shop-id";

/** The team moved into Boutique (K4): the old address opens Boutique › Équipe. */
export default async function TeamMoved({ params }: { params: Promise<{ locale: string; shop: string }> }) {
  const { locale, shop } = await params;
  if (!isShopId(shop)) notFound();
  permanentRedirect(shopRoutes(asLocale(locale), shop).team);
}
