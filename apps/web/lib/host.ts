import { RESERVED_SLUGS } from "@akinaza/core";

import { SITE_URL } from "./site";

/**
 * Two sites, one app: dev.akinaza.com (the product) and admin.akinaza.com (the administration console). The proxy
 * decides by the host: on the admin host every page is the console (`/en/users` is served by `/en/console/users`) and
 * nothing else; on the product host the console does not exist (404). Pure, so it is tested without a server.
 */
export const isAdminHost = (host: string | null | undefined) => /^admin\./i.test(host ?? "");

/** Hosts of the platform itself, never a shop (`www`, `dev`, `admin`… and the slugs a shop can never take). */
const PLATFORM_HOSTS = new Set(["www", "dev", "admin", "api", "app", "mail", "cname", "cdn", "static", "status", "staging", ...RESERVED_SLUGS]);
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * A shop's own address (krizaka/akinaza#77, level 2): `<slug>.akinaza.com` is the shop page, `apex` the platform's domain
 * (akinaza.com). One label, a well-formed slug, never a platform host; null for anything else.
 */
export function shopOfHost(host: string | null | undefined, apex: string): string | null {
  const name = (host ?? "").toLowerCase().replace(/:\d+$/, "");
  if (!name.endsWith(`.${apex}`)) return null;
  const label = name.slice(0, -apex.length - 1);
  return !label.includes(".") && SLUG.test(label) && label.length >= 3 && label.length <= 40 && !PLATFORM_HOSTS.has(label) ? label : null;
}

export type HostRoute = { kind: "next" } | { kind: "rewrite"; path: string } | { kind: "redirect"; path: string } | { kind: "notFound" } | { kind: "robotsClosed" };

const LOCALE = /^\/(en|fr)(?=\/|$)/;

export function routeFor(host: string | null | undefined, pathname: string, preferred: "en" | "fr", site = SITE_URL): HostRoute {
  const locale = LOCALE.exec(pathname)?.[1];
  const shop = shopOfHost(host, new URL(site).hostname.replace(/^www\./, ""));
  if (shop) {
    // The shop page at the root (the short address stays in the bar), its journey as it links it, everything else on www.
    if (pathname === "/robots.txt") return { kind: "robotsClosed" };
    if (pathname === "/" || (locale && pathname === `/${locale}`)) return { kind: "rewrite", path: `/${locale ?? preferred}/s/${shop}` };
    const rest = locale ? pathname.slice(locale.length + 1) : "";
    if (rest === `/s/${shop}` || rest.startsWith(`/s/${shop}/`)) return { kind: "next" };
    return { kind: "redirect", path: new URL(pathname, site).toString() };
  }
  if (isAdminHost(host)) {
    if (pathname === "/robots.txt") return { kind: "robotsClosed" };
    if (pathname === "/sitemap.xml" || pathname === "/llms.txt") return { kind: "notFound" };
    if (!locale) return { kind: "redirect", path: `/${preferred}${pathname === "/" ? "" : pathname}` };
    const rest = pathname.slice(locale.length + 1);
    if (rest === "/console" || rest.startsWith("/console/")) return { kind: "redirect", path: `/${locale}${rest.slice("/console".length)}` };
    return { kind: "rewrite", path: `/${locale}/console${rest}` };
  }
  if (pathname === "/robots.txt" || pathname === "/sitemap.xml" || pathname === "/llms.txt") return { kind: "next" };
  if (!locale) return { kind: "redirect", path: `/${preferred}${pathname === "/" ? "" : pathname}` };
  const rest = pathname.slice(locale.length + 1);
  if (rest === "/console" || rest.startsWith("/console/")) return { kind: "notFound" };
  return { kind: "next" };
}
