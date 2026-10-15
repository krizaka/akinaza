import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const packageVersion = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;
// package.json's version + the short commit DigitalOcean passes at build (APP_COMMIT_SHA): the version every page shows.
const appVersion = process.env.APP_VERSION?.trim() || (process.env.APP_COMMIT_SHA ? `${packageVersion}+${process.env.APP_COMMIT_SHA.slice(0, 7)}` : packageVersion);
const production = process.env.NODE_ENV === "production";

/**
 * Content Security Policy: nothing but this origin — no third-party script, frame or font. Next renders
 * inline bootstrap scripts without a nonce, so scripts keep 'unsafe-inline'. Development adds what the dev server needs.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${production ? "" : " ws: http://localhost:* http://127.0.0.1:*"}`,
  "frame-src 'none'",
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

// A dev / preview deployment is closed to search engines on every response, the API included (the proxy covers pages).
const closedToSearch = process.env.APP_SEARCH_INDEXING?.trim().toLowerCase() === "off";
if (closedToSearch) securityHeaders.push({ key: "X-Robots-Tag", value: "noindex, nofollow" });

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // The monorepo root: the standalone server then carries @akinaza/core and the hoisted dependencies.
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  reactStrictMode: true,
  poweredByHeader: false,
  env: { NEXT_PUBLIC_APP_VERSION: appVersion },
  transpilePackages: ["@akinaza/core", "@akinaza/db"],
  // The SQL migrations travel with the standalone server (lib/db.ts reads them at start).
  outputFileTracingIncludes: { "/*": ["../../packages/db/drizzle/**"] },
  // The pool stays a Node module, required at run time.
  serverExternalPackages: ["pg"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
