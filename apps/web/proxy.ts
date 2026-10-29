import { landingRedirect, sessionHint } from "@krizaka/auth";
import { type NextRequest, NextResponse } from "next/server";

import { isAdminHost, routeFor, shopOfHost } from "./lib/host";
import { CLOSED_ROBOTS, closedRobots, devRedirect, indexableOn, isDevHost, NOINDEX } from "./lib/indexing";
import { LOCALE_HEADER, negotiateLocale, pageLocaleOf,PATH_HEADER } from "./lib/locale-negotiation";
import { SESSION_COOKIE } from "./lib/session-cookie";
import { SITE_URL } from "./lib/site";

/** krizaka-ui#827: a signed-in person never sees the public landing page; the cookie is a hint, the app and the API still resolve the session. */
const LANDING = ["/", "/fr", "/en"] as const;

/**
 * Every page exists in English and French (`/en/…`, `/fr/…`); an address without a language goes to the visitor's choice
 * (cookie `NEXT_LOCALE`), else French (Loi 96) unless the browser asks for English and never French. admin.akinaza.com serves only the administration console (lib/host.ts), never
 * indexed; dev.akinaza.com never serves it. The API never passes here.
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host");
  const closed = !indexableOn(host);
  const pathname = request.nextUrl.pathname;
  // dev.<product>.com (APP_DEV_HOST): robots.txt closes everything; a page goes to www (308); the API, .well-known and
  // healthz keep serving - all noindex. Nothing below runs for it.
  if (isDevHost(host)) {
    const headers = { "x-robots-tag": NOINDEX };
    if (pathname === "/robots.txt") return new NextResponse(closedRobots(), { headers: { ...headers, "content-type": "text/plain" } });
    const to = devRedirect(request.method, pathname, request.nextUrl.search, process.env.APP_PUBLIC_URL ?? SITE_URL);
    if (to) return NextResponse.redirect(to, { status: 308, headers });
    const response = NextResponse.next();
    response.headers.set("x-robots-tag", NOINDEX);
    return response;
  }
  // The API and /.well-known pass untouched; on a host closed to search engines they say noindex.
  if (pathname.startsWith("/api/") || pathname.startsWith("/.well-known/")) {
    const response = NextResponse.next();
    if (closed) response.headers.set("x-robots-tag", NOINDEX);
    return response;
  }
  const chosen = negotiateLocale(request.cookies.get("NEXT_LOCALE")?.value, request.headers.get("accept-language"));
  const site = process.env.APP_PUBLIC_URL ?? SITE_URL;
  const route = routeFor(host, request.nextUrl.pathname, chosen, site);
  const admin = isAdminHost(host);
  const home = admin ? null : landingRedirect(request, { cookie: SESSION_COOKIE, landing: LANDING, home: () => `/${pageLocaleOf(pathname, chosen)}/app` });
  if (home) {
    // Relative: the browser keeps the origin it asked (the library's absolute Location took the server's idea of its own origin: https://localhost in CI).
    const target = new URL(home.headers.get("Location") ?? "/", request.url);
    home.headers.set("Location", `${target.pathname}${target.search}`);
    return home;
  }
  // <slug>.akinaza.com shows a shop page that www also serves: never indexed twice.
  const shopHost = shopOfHost(host, new URL(site).hostname.replace(/^www\./, "")) !== null;
  // A deployment closed to search engines (APP_SEARCH_INDEXING=off): robots.txt disallows everything (the sitemap is still served, noindexed).
  if (closed && request.nextUrl.pathname === "/robots.txt") return new NextResponse(CLOSED_ROBOTS, { headers: { "content-type": "text/plain", "x-robots-tag": NOINDEX } });
  // The language of the address, handed to the pages (the 404 has no params): set on the request, never trusted from the client.
  const forwarded = new Headers(request.headers);
  forwarded.set(LOCALE_HEADER, pageLocaleOf(pathname, chosen));
  forwarded.set(PATH_HEADER, pathname + request.nextUrl.search);
  let response: NextResponse;
  switch (route.kind) {
    case "robotsClosed":
      return new NextResponse("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain", "x-robots-tag": "noindex, nofollow" } });
    case "notFound":
      return new NextResponse("Not found", { status: 404, headers: admin ? { "x-robots-tag": "noindex, nofollow" } : {} });
    case "redirect": {
      // The public host, not the platform's internal one: admin.akinaza.com stays admin.akinaza.com.
      const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
      return NextResponse.redirect(new URL(route.path, host ? `${proto}://${host}` : request.url));
    }
    case "rewrite":
      response = NextResponse.rewrite(new URL(route.path, request.url), { request: { headers: forwarded } });
      break;
    default:
      response = NextResponse.next({ request: { headers: forwarded } });
  }
  const segment = request.nextUrl.pathname.split("/")[1];
  if ((segment === "en" || segment === "fr") && request.cookies.get("NEXT_LOCALE")?.value !== segment) {
    response.cookies.set("NEXT_LOCALE", segment, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  if (admin || closed || shopHost) response.headers.set("x-robots-tag", NOINDEX);
  return sessionHint(response, request, { cookie: SESSION_COOKIE, secure: process.env.NODE_ENV === "production" });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|og.png|favicon.ico|icon.svg|maplibre/|.*\\.(?:js|mjs|css|map|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf|webm|mp4|vtt|json|pbf|pmtiles|webmanifest|txt|xml|pdf|zip)$).*)", "/robots.txt", "/sitemap.xml", "/llms.txt", "/api/:path*", "/.well-known/:path*"],
};
