import { shopOriginOf } from "./shop-domain";

const escapeXml = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/**
 * A shop host's sitemap (ADR-005 §9): one URL per language the owner offers, on the shop's own origin (built from configuration, never from `Host`), each with the
 * hreflang alternates of the others and `x-default` on the source language (the first one listed).
 */
export function shopSitemapXml(slug: string, languages: readonly string[], lastModified: Date, vars: Record<string, string | undefined>): string {
  const origin = shopOriginOf(slug, vars);
  const link = (hreflang: string, language: string) => `<xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(origin + "/" + language)}"/>`;
  const alternates = [...languages.map((l) => link(l, l)), ...languages.slice(0, 1).map((l) => link("x-default", l))].join("");
  const stamp = lastModified.toISOString();
  const url = (l: string) => `<url><loc>${escapeXml(origin + "/" + l)}</loc><lastmod>${stamp}</lastmod>${alternates}</url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${languages.map(url).join("")}</urlset>\n`;
}
