import { shopOfHost } from "./host";
import { publicHost } from "./indexing";

type Vars = Record<string, string | undefined>;

const bare = (host: string | null | undefined) => (host ?? "").trim().toLowerCase().replace(/:\d+$/, "");
const DOMAIN = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/;
const APP_DEFAULT = "https://www.akinaza.com";

/**
 * ADR-005 slice 5 (akinaza#538): the registrable domain the shops live on (`akinaza.shop`), declared by `APP_SHOP_DOMAIN`. A separate
 * registrable name is a separate site: no cookie of the app reaches a shop host and a script on a shop cannot toss one for `www`.
 * Unset (or malformed): shops stay on `<slug>.<apex of the app>`, as before. The environment is a parameter (pure, tested).
 */
export function shopDomain(vars: Vars): string | null {
  const name = bare(vars.APP_SHOP_DOMAIN);
  return DOMAIN.test(name) ? name : null;
}

/** The shop a host names: `<slug>.<shop domain>` (`own`) or the legacy `<slug>.<apex of the app>`; null for any other host. */
export function shopHostOf(host: string | null | undefined, vars: Vars): { slug: string; own: boolean } | null {
  const own = shopDomain(vars);
  const ownSlug = own ? shopOfHost(host, own) : null;
  if (ownSlug) return { slug: ownSlug, own: true };
  const legacy = shopOfHost(host, publicHost(vars).replace(/^www\./, ""));
  return legacy ? { slug: legacy, own: false } : null;
}

/** The shop domain's own apex and its `www`: they belong to no shop, they lead to the app. */
export function isShopDomainRoot(host: string | null | undefined, vars: Vars): boolean {
  const own = shopDomain(vars);
  const name = bare(host);
  return !!own && (name === own || name === `www.${own}`);
}

/**
 * A shop's canonical origin, built from the configuration only (never from `Host` or `X-Forwarded-*`): the shop domain when declared, else the
 * app's apex. The scheme and the port are the app's own (`https`, or the plain-http origin of a CI server).
 */
export function shopOriginOf(slug: string, vars: Vars): string {
  const app = new URL(vars.APP_PUBLIC_URL ?? APP_DEFAULT);
  const domain = shopDomain(vars) ?? publicHost(vars).replace(/^www\./, "");
  const port = app.port ? ":" + app.port : "";
  return `${app.protocol}//${slug}.${domain}${port}`;
}

/** The app's own origin: where the booking hop and every non-shop address lead. */
export const appOriginOf = (vars: Vars): string => new URL(vars.APP_PUBLIC_URL ?? APP_DEFAULT).origin;

/** A shop page's canonical address in one language: absolute on the shop domain once declared, else the path on the app (as before). */
export function shopPageUrl(slug: string, locale: string, vars: Vars): string {
  return shopDomain(vars) ? `${shopOriginOf(slug, vars)}/${locale}` : `/${locale}/s/${slug}`;
}

/** Shop pages are kept out of search engines for now (ADR-005 §9: opened by the founder, then the sitemap says so). One switch for the meta, the header and the sitemap. */
export const SHOP_PAGES_INDEXABLE = false;
