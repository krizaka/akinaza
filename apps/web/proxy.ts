import { type NextRequest, NextResponse } from "next/server";

import { HOST_FREE_PATHS, isAllowedHost } from "./lib/allowed-hosts";
import { cookieName, dropCookie, ownCookie } from "./lib/cookie";
import { contentSecurityPolicy, isShopPath, newNonce, upgradesInsecure } from "./lib/csp";
import { refusesCrossSiteWrite } from "./lib/csrf";
import { type HostRoute, isAdminHost, routeFor, type ShopHosting } from "./lib/host";
import { CLOSED_ROBOTS, closedRobots, devRedirect, indexableOn, isDevHost, NOINDEX } from "./lib/indexing";
import { LOCALE_HEADER, negotiateLocale, pageLocaleOf,PATH_HEADER } from "./lib/locale-negotiation";
import { SESSION_COOKIE } from "./lib/session-cookie";
import { SHOP_SITEMAP_PATH, shopVerdict, Verdict } from "./lib/shop-directory";
import { appOriginOf, shopDomain, shopHostOf, shopOriginOf } from "./lib/shop-domain";
import { SITE_URL } from "./lib/site";

const LOCALE_COOKIE = cookieName("NEXT_LOCALE");

/** ADR-005 slice 1 (akinaza#534): a write to the API that carries the web session comes from this origin, else 403 (a shop host is same-site: SameSite=Lax does not stop it). */
function crossSiteWrite(request: NextRequest): NextResponse | null {
  if (!request.nextUrl.pathname.startsWith("/api/")) return null;
  const refused = refusesCrossSiteWrite({ method: request.method, headers: request.headers, origin: process.env.APP_PUBLIC_URL ?? SITE_URL, sessionCookie: SESSION_COOKIE });
  return refused ? NextResponse.json({ error: { code: "CROSS_SITE_WRITE", message: "This request does not come from the app" } }, { status: 403 }) : null;
}

/** The policy of a response (lib/csp.ts), read per request: the nonce of a shop page is this response's own, the declared origin is the runtime's. */
function policy(nonce?: string, appOrigin?: string): string {
  const production = process.env.NODE_ENV === "production";
  return contentSecurityPolicy({ nonce, production, upgradeInsecure: upgradesInsecure(production, process.env.APP_PUBLIC_URL), appOrigin });
}

/**
 * The policy of a page. The public shop pages run only scripts that carry this response's nonce (ADR-005, #535): it goes on the request too, where Next
 * reads it to stamp its own scripts. The route says which page it is (a shop host is rewritten to the shop's path).
 */
function stampPolicy(forwarded: Headers, route: HostRoute, pathname: string, appOrigin?: string): string {
  const path = route.kind === "rewrite" ? route.path : pathname;
  if (!isShopPath(path)) return policy();
  const nonce = newNonce();
  const csp = policy(nonce, appOrigin);
  forwarded.set("content-security-policy", csp);
  forwarded.set("x-nonce", nonce);
  return csp;
}

/**
 * Every page exists in English and French (`/en/…`, `/fr/…`); an address without a language goes to the visitor's choice
 * (cookie `NEXT_LOCALE`), else French (Loi 96) unless the browser asks for English and never French. admin.akinaza.com serves only the administration console (lib/host.ts), never
 * indexed; dev.akinaza.com never serves it. The API never passes here.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const host = request.headers.get("host");
  const closed = !indexableOn(host);
  const pathname = request.nextUrl.pathname;
  // ADR-005 slice 4 (#536): a host this deployment does not serve is answered 421 before anything is routed or built from it (the platform's health check names its own).
  if (!HOST_FREE_PATHS.includes(pathname) && !isAllowedHost(host, process.env)) return new NextResponse("Misdirected Request", { status: 421, headers: { "content-type": "text/plain", "x-robots-tag": NOINDEX } });
  // The dev host serves the API too: the check comes first.
  const refused = crossSiteWrite(request);
  if (refused) return refused;
  // dev.<product>.com (APP_DEV_HOST): robots.txt closes everything; a page goes to www (308); the API, .well-known and
  // healthz keep serving - all noindex. Nothing below runs for it.
  if (isDevHost(host)) {
    const headers = { "x-robots-tag": NOINDEX };
    if (pathname === "/robots.txt") return new NextResponse(closedRobots(), { headers: { ...headers, "content-type": "text/plain" } });
    const to = devRedirect(request.method, pathname, request.nextUrl.search, process.env.APP_PUBLIC_URL ?? SITE_URL);
    if (to) return NextResponse.redirect(to, { status: 308, headers });
    const response = NextResponse.next();
    response.headers.set("x-robots-tag", NOINDEX);
    response.headers.set("Content-Security-Policy", policy());
    return response;
  }
  // The API and /.well-known pass untouched; on a host closed to search engines they say noindex.
  if (pathname.startsWith("/api/") || pathname.startsWith("/.well-known/")) {
    const response = NextResponse.next();
    if (closed) response.headers.set("x-robots-tag", NOINDEX);
    response.headers.set("Content-Security-Policy", policy());
    return response;
  }
  // A shop's own host (ADR-005 slice 4, #549): served only when that shop exists and is public, else 404 before anything is routed; a former address goes to the current one (308).
  const shop = shopHostOf(host, process.env);
  if (shop) {
    return shopVerdict(shop.slug).then((verdict) => {
      if (verdict.kind === Verdict.None) return new NextResponse("Not found", { status: 404, headers: { "content-type": "text/plain", "x-robots-tag": NOINDEX, "cache-control": "private, no-store" } });
      if (verdict.kind === Verdict.Moved) return NextResponse.redirect(`${shopOriginOf(verdict.slug, process.env)}${pathname}${request.nextUrl.search}`, { status: 308, headers: { "x-robots-tag": NOINDEX } });
      return serve(request, closed, shop.own);
    });
  }
  return serve(request, closed, false);
}

/** The shop domain's moves (lib/host.ts `hostedRoute`), when it is declared. */
function hostingOf(): ShopHosting | null {
  const domain = shopDomain(process.env);
  return domain ? { domain, origin: (slug) => shopOriginOf(slug, process.env) } : null;
}

/** `ownShopHost`: the request is on `<slug>.<APP_SHOP_DOMAIN>`, where nothing of the app's session ever goes (ADR-005 §1, §4). */
function serve(request: NextRequest, closed: boolean, ownShopHost: boolean): NextResponse {
  const host = request.headers.get("host");
  const pathname = request.nextUrl.pathname;
  const chosen = negotiateLocale(request.cookies.get(LOCALE_COOKIE)?.value, request.headers.get("accept-language"));
  const site = process.env.APP_PUBLIC_URL ?? SITE_URL;
  const route = routeFor(host, request.nextUrl.pathname, chosen, site, hostingOf());
  const admin = isAdminHost(host);
  // A shop's address shows a page that www may also serve: never indexed twice.
  const shop = shopHostOf(host, process.env);
  const shopHost = shop !== null;
  // A deployment closed to search engines (APP_SEARCH_INDEXING=off): robots.txt disallows everything (the sitemap is still served, noindexed).
  if (closed && request.nextUrl.pathname === "/robots.txt") return new NextResponse(CLOSED_ROBOTS, { headers: { "content-type": "text/plain", "x-robots-tag": NOINDEX } });
  // The language of the address, handed to the pages (the 404 has no params): set on the request, never trusted from the client.
  const forwarded = new Headers(request.headers);
  forwarded.set(LOCALE_HEADER, pageLocaleOf(pathname, chosen));
  forwarded.set(PATH_HEADER, pathname + request.nextUrl.search);
  // No session ever reaches a shop's page (it renders for a stranger): the app's cookie is dropped from what the page reads, whatever the browser sent.
  if (shopHost) forwarded.set("cookie", dropCookie(request.headers.get("cookie"), SESSION_COOKIE));
  const csp = stampPolicy(forwarded, route, pathname, ownShopHost ? appOriginOf(process.env) : undefined);
  let response: NextResponse;
  switch (route.kind) {
    case "robotsClosed": {
      const sitemap = shop ? `Sitemap: ${shopOriginOf(shop.slug, process.env)}/sitemap.xml\n` : "";
      return new NextResponse(`User-agent: *\nDisallow: /\n${sitemap}`, { headers: { "content-type": "text/plain", "x-robots-tag": "noindex, nofollow" } });
    }
    case "shopSitemap":
      response = NextResponse.rewrite(new URL(SHOP_SITEMAP_PATH, request.url), { request: { headers: forwarded } });
      break;
    case "notFound":
      return new NextResponse("Not found", { status: 404, headers: admin ? { "x-robots-tag": "noindex, nofollow" } : {} });
    case "redirect":
      return redirectOf(request, route, host);
    case "rewrite":
      response = NextResponse.rewrite(new URL(route.path, request.url), { request: { headers: forwarded } });
      break;
    default:
      response = NextResponse.next({ request: { headers: forwarded } });
  }
  return dressed(response, request, { csp, noindex: admin || closed || shopHost, noStore: ownShopHost });
}

/** A redirect on the public host, not the platform's internal one: admin.akinaza.com stays admin.akinaza.com. */
function redirectOf(request: NextRequest, route: Extract<HostRoute, { kind: "redirect" }>, host: string | null): NextResponse {
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const target = new URL(route.path, host ? `${proto}://${host}` : request.url);
  // A move of the shop domain keeps the query and answers 308 (the booking hop and the old addresses); the others keep their 307.
  if (route.permanent) target.search = request.nextUrl.search;
  return NextResponse.redirect(target, route.permanent ? { status: 308, headers: { "x-robots-tag": NOINDEX } } : undefined);
}

/** What every served response wears: the language of its address in a cookie, no index where the page is not for search, no shared cache on a shop's host, the policy. */
function dressed(response: NextResponse, request: NextRequest, { csp, noindex, noStore }: { csp: string; noindex: boolean; noStore: boolean }): NextResponse {
  const segment = request.nextUrl.pathname.split("/")[1];
  if ((segment === "en" || segment === "fr") && request.cookies.get(LOCALE_COOKIE)?.value !== segment) {
    response.cookies.set(ownCookie(LOCALE_COOKIE, segment, { httpOnly: false, maxAge: 60 * 60 * 24 * 365 }));
  }
  if (noindex) response.headers.set("x-robots-tag", NOINDEX);
  // The page of a shop is for one request: never shared from a cache whose key could lose the host (ADR-005 §3).
  if (noStore) response.headers.set("cache-control", "private, no-store");
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|og.png|favicon.ico|icon.svg|maplibre/|.*\\.(?:js|mjs|css|map|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf|webm|mp4|vtt|json|pbf|pmtiles|webmanifest|txt|xml|pdf|zip)$).*)", "/robots.txt", "/sitemap.xml", "/llms.txt", "/api/:path*", "/.well-known/:path*"],
};
