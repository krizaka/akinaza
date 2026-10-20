import { SITE_URL } from "./site";

/**
 * One flag decides whether this deployment is open to search engines: `APP_SEARCH_INDEXING=off` (every dev and preview
 * deployment) puts `noindex, nofollow` on every response and closes robots.txt (the sitemap stays served, noindexed: the family contract), and shows the
 * development notice in the footer. Anything else (default `on`) leaves the public pages open to crawlers.
 */
export const indexable = (env: Record<string, string | undefined> = process.env): boolean => env.APP_SEARCH_INDEXING?.trim().toLowerCase() !== "off";

export const NOINDEX = "noindex, nofollow";
export const CLOSED_ROBOTS = `User-agent: *\nDisallow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`;
