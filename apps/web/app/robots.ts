import type { MetadataRoute } from "next";

import { indexableOn } from "@/lib/indexing";
import { CRAWLERS } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

/** The public pages are open to every crawler; the signed-in space and the API are not for them. */
export default function robots(): MetadataRoute.Robots {
  // www.akinaza.com is a code-name host: closed (wave 1, krizaka-internal#2630). The sitemap stays named, for the day it opens.
  if (!indexableOn(new URL(SITE_URL).host)) {return { rules: [{ userAgent: "*", disallow: "/" }], sitemap: `${SITE_URL}/sitemap.xml` };}
  const disallow = ["/api/", "/en/app", "/fr/app", "/en/sign-in", "/fr/sign-in"];
  return {
    rules: [{ userAgent: "*", allow: "/", disallow }, ...CRAWLERS.map((userAgent) => ({ userAgent, allow: "/", disallow }))],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
