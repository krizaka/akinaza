import { type NextRequest, NextResponse } from "next/server";

import { isAdminHost, routeFor } from "./lib/host";
import { CLOSED_ROBOTS, closedRobots, devRedirect, indexableOn, isDevHost, NOINDEX } from "./lib/indexing";
import { SITE_URL } from "./lib/site";

/**
 * Every page exists in English and French (`/en/…`, `/fr/…`); an address without a language goes to the visitor's choice
 * (cookie `NEXT_LOCALE`), else English. admin.akinaza.com serves only the administration console (lib/host.ts), never
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
  const chosen = request.cookies.get("NEXT_LOCALE")?.value === "fr" ? "fr" : "en";
  const route = routeFor(host, request.nextUrl.pathname, chosen);
  const admin = isAdminHost(host);
  // A deployment closed to search engines (APP_SEARCH_INDEXING=off): robots.txt disallows everything (the sitemap is still served, noindexed).
  if (closed && request.nextUrl.pathname === "/robots.txt") return new NextResponse(CLOSED_ROBOTS, { headers: { "content-type": "text/plain", "x-robots-tag": NOINDEX } });
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
      response = NextResponse.rewrite(new URL(route.path, request.url));
      break;
    default:
      response = NextResponse.next();
  }
  const segment = request.nextUrl.pathname.split("/")[1];
  if ((segment === "en" || segment === "fr") && request.cookies.get("NEXT_LOCALE")?.value !== segment) {
    response.cookies.set("NEXT_LOCALE", segment, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  if (admin || closed) response.headers.set("x-robots-tag", NOINDEX);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|og.png|favicon.ico|icon.svg|.*\\..*).*)", "/robots.txt", "/sitemap.xml", "/llms.txt", "/api/:path*", "/.well-known/:path*"],
};
