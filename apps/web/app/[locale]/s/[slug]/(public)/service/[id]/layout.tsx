import { notFound } from "next/navigation";

import { loadPublicShop } from "@/lib/shop-page";

/**
 * A service that does not exist (or is not the shop's) answers 404 with the status 404 (akinaza#293). The pages stream behind
 * `loading.tsx`, so a `notFound()` thrown there arrives after the 200 has left; this layout sits above that boundary and decides
 * first. A former shop address passes: the page itself moves it (308) with the rest of the path.
 */
export default async function ServiceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const page = await loadPublicShop(slug);
  if (page && !page.services.some((s) => s.id === id)) notFound();
  return children;
}
