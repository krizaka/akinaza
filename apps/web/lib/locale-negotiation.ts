export type SiteLocale = "fr" | "en";

/** Loi 96: French is the site's language by default. */
export const FALLBACK_LOCALE: SiteLocale = "fr";

/**
 * The language of a visitor on an unprefixed URL.
 * 1. the cookie they set (the language switch), whichever it is;
 * 2. else English only when the browser asks for English and never for French;
 * 3. else French (no header, a bot, any French, any other language).
 */
export function negotiateLocale(cookie: string | undefined, acceptLanguage: string | null | undefined): SiteLocale {
  if (cookie === "fr" || cookie === "en") return cookie;
  const tags = (acceptLanguage ?? "")
    .split(",")
    .map((part) => part.trim().split(";")[0].toLowerCase())
    .filter(Boolean);
  const asksFrench = tags.some((t) => t === "fr" || t.startsWith("fr-"));
  const asksEnglish = tags.some((t) => t === "en" || t.startsWith("en-"));
  return asksEnglish && !asksFrench ? "en" : FALLBACK_LOCALE;
}

/** The request header the proxy sets with the language of the address, read by the 404 pages (which have no params). */
export const LOCALE_HEADER = "x-akinaza-locale";

/** The request header the proxy sets with the requested path and query, read by the signed-in guard to come back after sign-in. */
export const PATH_HEADER = "x-akinaza-path";

/** The language of a page's address: its `/en` or `/fr` segment, else the visitor's choice. Never the cookie's stale value. */
export function pageLocaleOf(pathname: string, chosen: SiteLocale): SiteLocale {
  const segment = pathname.split("/")[1];
  return segment === "en" || segment === "fr" ? segment : chosen;
}
