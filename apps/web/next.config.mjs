import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const packageVersion = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;
// package.json's version + the short commit DigitalOcean passes at build (APP_COMMIT_SHA): the version every page shows.
const appVersion = process.env.APP_VERSION?.trim() || (process.env.APP_COMMIT_SHA ? `${packageVersion}+${process.env.APP_COMMIT_SHA.slice(0, 7)}` : packageVersion);
const production = process.env.NODE_ENV === "production";

/**
 * Content Security Policy: nothing but this origin — no third-party script or font, and a frame only for the three embed hosts, after a click. Next renders
 * inline bootstrap scripts without a nonce, so scripts keep 'unsafe-inline'. Development adds what the dev server needs.
 */
/** The only third parties a page may frame: the players of a TikTok, a YouTube Short and an Instagram reel, behind a click (packages/core/src/community.ts `externalReel`). */
export const EMBED_FRAME_HOSTS = ["https://www.youtube-nocookie.com", "https://www.tiktok.com", "https://www.instagram.com"];

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://krizaka-assets.b-cdn.net",
  "media-src 'self' https://krizaka-assets.b-cdn.net",
  "font-src 'self' data:",
  // The map's engine (MapLibre) runs its worker from a blob; its tiles and glyphs come through this origin (/maps/v1).
  "worker-src 'self' blob:",
  `connect-src 'self'${production ? "" : " ws: http://localhost:* http://127.0.0.1:*"}`,
  // The studio previews the page in a frame of its own origin; the three video platforms may fill a frame only after a visitor pressed a facade's button (nothing is framed before the click).
  `frame-src 'self' ${EMBED_FRAME_HOSTS.join(" ")}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  ...(production ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

// The noindex of a closed deployment is per host (www is public, dev is not): the proxy says it, API included (proxy.ts).

/** A shop is named in addresses by its id (a UUID): anything else is not a shop and falls through to the 404. */
const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

/**
 * The old addresses and what replaced them, all 308 (akinaza#381). They sit here, in the configuration, and not in pages that only redirect.
 * The five addresses from before the shop was in the path (`/app/books`, `/app/clients`…) need the shop last worked in, which a
 * configuration cannot know: they stay route handlers with a 307 (`lib/legacy-redirect.ts`).
 */
export const retiredAddresses = [
  { source: "/:locale(en|fr)/changelog/feed.xml", destination: "/:locale", permanent: true },
  { source: "/:locale(en|fr)/changelog", destination: "/:locale", permanent: true },
  { source: "/:locale(en|fr)/app/connections", destination: "/:locale/app", permanent: true },
  // « Ma page boutique », the languages and the team moved into Boutique (K4).
  { source: `/:locale(en|fr)/app/:shop(${UUID})/shop`, destination: "/:locale/app/:shop/boutique/page", permanent: true },
  { source: `/:locale(en|fr)/app/:shop(${UUID})/shop/languages`, destination: "/:locale/app/:shop/boutique/languages", permanent: true },
  { source: `/:locale(en|fr)/app/:shop(${UUID})/team`, destination: "/:locale/app/:shop/boutique/team", permanent: true },
  // One way to book: the public steps, signing in at the last one. The old signed-in page keeps its service, person, area and time.
  { source: "/:locale(en|fr)/s/:slug/book", has: [{ type: "query", key: "service", value: `(?<service>${UUID})` }], destination: "/:locale/s/:slug/service/:service/confirm", permanent: true },
  { source: "/:locale(en|fr)/s/:slug/book", destination: "/:locale/s/:slug", permanent: true },
  // One language of addresses: English (the code's). The French word of a public step answers 308.
  { source: "/:locale(en|fr)/s/:slug/service/:id/creneau", destination: "/:locale/s/:slug/service/:id/slots", permanent: true },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // The monorepo root: the standalone server then carries @akinaza/core and the hoisted dependencies.
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  reactStrictMode: true,
  // The 404 of an unknown address is branded too: app/global-not-found.tsx (it bypasses the [locale] layout).
  experimental: { globalNotFound: true },
  poweredByHeader: false,
  env: { NEXT_PUBLIC_APP_VERSION: appVersion },
  transpilePackages: ["@akinaza/core", "@akinaza/db"],
  // The SQL migrations travel with the standalone server (lib/db.ts reads them at start).
  outputFileTracingIncludes: { "/*": ["../../packages/db/drizzle/**"] },
  // The pool stays a Node module, required at run time.
  serverExternalPackages: ["pg"],
  // The basemap of the shop pages: Protomaps tiles on the media CDN, read through this origin (the CDN sends no CORS headers).
  async rewrites() {
    return [{ source: "/maps/v1/:path*", destination: "https://krizaka-assets.b-cdn.net/maps/v1/:path*" }];
  },
  // The retired pages answer 308 to what replaced them.
  async redirects() {
    return retiredAddresses;
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // App links files (assetlinks.json, apple-app-site-association) are for the apps, never for search.
      { source: "/.well-known/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
