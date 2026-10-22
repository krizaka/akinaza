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
