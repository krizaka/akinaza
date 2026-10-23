import { notFound } from "next/navigation";

import { loadPublicShop, movedShopPath } from "@/lib/shop-page";

/**
 * A shop's public pages answer 404 with the status 404. The page itself streams behind `loading.tsx`: a `notFound()` thrown
 * there arrives after the 200 has left (the deployed shop 404 answered 200). The layout sits above that boundary, so it
 * decides before anything streams: an address that is neither a published shop nor a former one is not found. The pages
 * keep the move of a former address (a 308 with the rest of the path).
 */
export default async function ShopLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!(await loadPublicShop(slug)) && !(await movedShopPath(locale, slug))) notFound();
  return children;
}
