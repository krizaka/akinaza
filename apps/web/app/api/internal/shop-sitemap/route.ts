import { slugSchema } from "@akinaza/core";
import { publicShop } from "@akinaza/db";

import { requestNow } from "@/app/request-now";
import { db } from "@/lib/db";
import { NOINDEX } from "@/lib/indexing";
import { SHOP_PAGES_INDEXABLE, shopHostOf } from "@/lib/shop-domain";
import { shopSitemapXml } from "@/lib/shop-sitemap";

export const dynamic = "force-dynamic";

/**
 * A shop host's `/sitemap.xml` (the proxy rewrites it here): the languages the owner offers, each an alternate of the others, on the shop's own origin.
 * The shop is the one the Host names, not a query: a route handler reads the URL the client asked (`/sitemap.xml`), never the rewrite's own query.
 */
export async function GET(request: Request) {
  const parsed = slugSchema.safeParse(shopHostOf(request.headers.get("host"), process.env)?.slug ?? "");
  const page = parsed.success ? await publicShop(db(), parsed.data) : null;
  if (!parsed.success || !page) {return new Response("Not found", { status: 404, headers: { "x-robots-tag": NOINDEX } });}
  const xml = shopSitemapXml(parsed.data, page.languages.enabled, requestNow(), process.env);
  return new Response(xml, { headers: { "content-type": "application/xml", "cache-control": "no-store", ...(SHOP_PAGES_INDEXABLE ? {} : { "x-robots-tag": NOINDEX }) } });
}
