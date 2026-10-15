/**
 * One flag decides whether this deployment is open to search engines: `APP_SEARCH_INDEXING=off` (every dev and preview
 * deployment) puts `noindex, nofollow` on every response, closes robots.txt and withdraws the sitemap, and shows the
 * development notice in the footer. Anything else (default `on`) leaves the public pages open to crawlers.
 */
export const indexable = (env: Record<string, string | undefined> = process.env): boolean => env.APP_SEARCH_INDEXING?.trim().toLowerCase() !== "off";

export const NOINDEX = "noindex, nofollow";
export const CLOSED_ROBOTS = "User-agent: *\nDisallow: /\n";
