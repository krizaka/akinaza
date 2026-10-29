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

export type HostRoute =
  | { kind: "next" }
  | { kind: "rewrite"; path: string }
  /** `permanent`: a 308 (the shop domain's moves); else a 307. */
  | { kind: "redirect"; path: string; permanent?: boolean }
  | { kind: "notFound" }
  | { kind: "robotsClosed" }
  /** A shop host's sitemap, rendered by the app for that shop alone. */
  | { kind: "shopSitemap"; slug: string };

/** Where shops live once they have a domain of their own (lib/shop-domain.ts): the domain, and the canonical origin of a shop (built from configuration, never from Host). */
export type ShopHosting = { domain: string; origin: (slug: string) => string };

const SHOP_PATH = /^\/(en|fr|es)\/s\/([a-z0-9]+(?:-[a-z0-9]+)*)(\/.*)?$/;
/** The pages of a shop that need the signed-in app: the booking's confirm step and its confirmation. They are a top-level hop to the app, never served on a shop host. */
export const isBookingHop = (rest: string): boolean => /^\/service\/[^/]+\/confirm(?:ation)?(?:\/|$)/.test(rest);

const LOCALE = /^\/(en|fr)(?=\/|$)/;
/** A shop page can also be offered in Spanish (#258): `/es/s/<slug>` is the only Spanish address; the product's own pages exist in English and French. */
const SPANISH_STOREFRONT = /^\/es\/s\/[^/]+\/?$/;

const moved = (path: string): HostRoute => ({ kind: "redirect", path, permanent: true });

/** A request on `<slug>.<shop domain>`: the shop page at the root, its public pages as linked, and a top-level hop to the app for everything else (the booking's last step included). */
function ownShopRoute(slug: string, pathname: string, site: string): HostRoute {
  if (pathname === "/robots.txt") return { kind: "robotsClosed" };
  if (pathname === "/sitemap.xml") return { kind: "shopSitemap", slug };
  const locale = LOCALE.exec(pathname)?.[1] ?? (SPANISH_STOREFRONT.test(pathname) || pathname === "/es" ? "es" : undefined);
  if (pathname === "/" || pathname === `/${locale}`) return { kind: "rewrite", path: `/${locale ?? "fr"}/s/${slug}` };
  const rest = locale ? pathname.slice(locale.length + 1) : "";
  const own = rest === `/s/${slug}` || rest.startsWith(`/s/${slug}/`);
  return own && !isBookingHop(rest.slice(`/s/${slug}`.length)) ? { kind: "next" } : moved(new URL(pathname, site).toString());
}

/** The old addresses of a shop, once its domain is declared: `/<locale>/s/<slug>` on the app (the booking's hop stays there). */
function oldPathRoute(pathname: string, hosting: ShopHosting): HostRoute | null {
  const page = SHOP_PATH.exec(pathname);
  if (!page || isBookingHop(page[3] ?? "")) return null;
  return moved(hosting.origin(page[2]) + (page[3] ? pathname : `/${page[1]}`));
}

/**
 * ADR-005 slice 5: with a shop domain declared, its apex and www lead to the app, `<slug>.<shop domain>` serves the shop and nothing of the app,
 * and the old addresses (`<slug>.<apex>`, `/<locale>/s/<slug>`) are 308s to it. Null: the host is not concerned.
 */
function hostedRoute(host: string | null | undefined, pathname: string, site: string, hosting: ShopHosting): HostRoute | null {
  const name = (host ?? "").toLowerCase().replace(/:\d+$/, "");
  if (name === hosting.domain || name === "www." + hosting.domain) return moved(new URL("/", site).toString());
  const slug = shopOfHost(name, hosting.domain);
  if (slug) return ownShopRoute(slug, pathname, site);
  const old = shopOfHost(name, new URL(site).hostname.replace(/^www\./, ""));
  if (old) return pathname === "/robots.txt" ? { kind: "robotsClosed" } : moved(hosting.origin(old) + pathname);
  return isAdminHost(host) ? null : oldPathRoute(pathname, hosting);
}

/** `<slug>.<apex>` (the short address): the shop page at the root, its journey as it links it, everything else on www. */
function shortShopRoute(shop: string, locale: string | undefined, pathname: string, preferred: "en" | "fr", site: string): HostRoute {
  if (pathname === "/robots.txt") return { kind: "robotsClosed" };
  if (pathname === "/" || (locale && pathname === `/${locale}`)) return { kind: "rewrite", path: `/${locale ?? preferred}/s/${shop}` };
  const rest = locale ? pathname.slice(locale.length + 1) : "";
  if (rest === `/s/${shop}` || rest.startsWith(`/s/${shop}/`)) return { kind: "next" };
  return { kind: "redirect", path: new URL(pathname, site).toString() };
}

/** `admin.*`: the console, served at the root of the host; no sitemap, no llms.txt. */
function adminRoute(locale: string | undefined, pathname: string, preferred: "en" | "fr"): HostRoute {
  if (pathname === "/robots.txt") return { kind: "robotsClosed" };
  if (pathname === "/sitemap.xml" || pathname === "/llms.txt") return { kind: "notFound" };
  if (!locale) return { kind: "redirect", path: `/${preferred}${pathname === "/" ? "" : pathname}` };
  const rest = pathname.slice(locale.length + 1);
  if (rest === "/console" || rest.startsWith("/console/")) return { kind: "redirect", path: `/${locale}${rest.slice("/console".length)}` };
  return { kind: "rewrite", path: `/${locale}/console${rest}` };
}

/** The app's own host: its files, the locale prefix, and no console (it lives on the admin host). */
function appHostRoute(locale: string | undefined, pathname: string, preferred: "en" | "fr"): HostRoute {
  if (pathname === "/robots.txt" || pathname === "/sitemap.xml" || pathname === "/llms.txt") return { kind: "next" };
  if (!locale) return { kind: "redirect", path: `/${preferred}${pathname === "/" ? "" : pathname}` };
  const rest = pathname.slice(locale.length + 1);
  if (rest === "/console" || rest.startsWith("/console/")) return { kind: "notFound" };
  return { kind: "next" };
}

export function routeFor(host: string | null | undefined, pathname: string, preferred: "en" | "fr", site = SITE_URL, hosting: ShopHosting | null = null): HostRoute {
  const hosted = hosting ? hostedRoute(host, pathname, site, hosting) : null;
  if (hosted) return hosted;
  const shop = shopOfHost(host, new URL(site).hostname.replace(/^www\./, ""));
  const locale = LOCALE.exec(pathname)?.[1] ?? (SPANISH_STOREFRONT.test(pathname) || (shop && pathname === "/es") ? "es" : undefined);
  if (shop) return shortShopRoute(shop, locale, pathname, preferred, site);
  return isAdminHost(host) ? adminRoute(locale, pathname, preferred) : appHostRoute(locale, pathname, preferred);
}
