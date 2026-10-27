/** Addresses of the site — structure, not words (the words are in messages/). */
export const SITE_URL = "https://www.akinaza.com";
export const REPO_URL = "https://github.com/krizaka/akinaza";
/** Krizaka, the publisher: named only in the footer and the legal mentions (the products are independent). */
export const KRIZAKA_URL = "https://www.krizaka.com";
export const PRIVACY_UPDATED = "2026-10-26";

/** The published privacy impact assessment and the register of transfers outside Québec (docs/privacy, akinaza#369). */
export const EFVP_URL = "https://github.com/krizaka/akinaza/blob/main/docs/privacy/efvp.md";
export const TRANSFERS_URL = "https://github.com/krizaka/akinaza/blob/main/docs/privacy/transfers.md";
/** The version of the terms of use (its date): kept in the audit trail when a subscription is started, so the accepted version is known. */
export const TERMS_VERSION = "2026-10-27";
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";

/** The public pages, in both languages (sitemap, hreflang). */
export const DOC_IDS = ["shop", "bookings", "invoices", "books", "data"] as const;
export type DocId = (typeof DOC_IDS)[number];
export const PAGES = ["home", "pricing", "privacy", "terms", "docs", "docs/shop", "docs/bookings", "docs/invoices", "docs/books", "docs/data"] as const satisfies readonly ("home" | "pricing" | "privacy" | "terms" | "docs" | `docs/${DocId}`)[];
export type PageId = (typeof PAGES)[number];
export const pagePath = (locale: "en" | "fr", page: PageId) => (page === "home" ? `/${locale}` : `/${locale}/${page}`);

/** Krizaka's contact form, Akinaza pre-selected. */
export function contactHref(source: string): string {
  return `${KRIZAKA_URL}/contact?topic=akinaza&source=${encodeURIComponent(source)}`;
}
