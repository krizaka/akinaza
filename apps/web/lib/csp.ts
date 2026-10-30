import { MEDIA_CDN } from "./tour";

/**
 * Content Security Policy (ADR-005 slice 3, akinaza#535). Two policies, one builder, set by the proxy on each response (a nonce is per request, so it
 * cannot live in next.config):
 *  - the public shop pages (`/<locale>/s/**`, a shop host) get the STRICT one: `default-src 'none'`, scripts only with this response's nonce
 *    (Next stamps it on its own scripts) and what they load (`strict-dynamic`), no `'unsafe-inline'` script, nothing eval'd in production;
 *  - every other page keeps the static policy (scripts `'self' 'unsafe-inline'`), since the app's screens carry inline bootstrap of @krizaka/* libraries.
 * Nothing but this origin: no third-party script or font, and a frame only for the three embed hosts, after a click.
 */

/** The only third parties a page may frame: the players of a TikTok, a YouTube Short and an Instagram reel, behind a click (packages/core/src/community.ts `externalReel`). */
export const EMBED_FRAME_HOSTS = ["https://www.youtube-nocookie.com", "https://www.tiktok.com", "https://www.instagram.com"];

const DEV_CONNECT = " ws: http://localhost:* http://127.0.0.1:*";

export type CspOptions = {
  /** Set: the strict policy of the shop pages, with this response's nonce. Unset: the static policy. */
  nonce?: string;
  production: boolean;
  /** `upgrade-insecure-requests` (production on https only: see `upgradesInsecure`). */
  upgradeInsecure: boolean;
  /**
   * Set on a shop's own domain (ADR-005 §6): the app's origin, the only place the page may submit to (the booking hop) and the only page that may frame it
   * (the studio's preview). Unset: the page's own origin, as before.
   */
  appOrigin?: string;
};

/** A fresh, unguessable nonce for one response (base64 of a random UUID, as Next's guide does). */
export function newNonce(): string {
  return btoa(crypto.randomUUID());
}

/**
 * A deployment whose declared public origin is plain http (the CI server of the crawls) cannot take `upgrade-insecure-requests`: it would send a
 * redirect hop (a prefetch of the landing that lands on /app) to https, where nothing listens. Any https or undeclared origin keeps it. Read per
 * request, never at build (the build task did not see the variable: #515).
 */
export function upgradesInsecure(production: boolean, publicUrl: string | undefined): boolean {
  return production && !(publicUrl ?? "").startsWith("http://");
}

/** The public shop pages: `/<locale>/s/<slug>/…`, the Spanish one included (a shop host is rewritten to the same paths). */
export function isShopPath(pathname: string): boolean {
  return /^\/(?:en|fr|es)\/s\//.test(pathname);
}

export function contentSecurityPolicy({ nonce, production, upgradeInsecure, appOrigin }: CspOptions): string {
  const strict = nonce !== undefined;
  const dev = production ? "" : " 'unsafe-eval'";
  const script = strict ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev}` : `script-src 'self' 'unsafe-inline'${dev}`;
  return [
    strict ? "default-src 'none'" : "default-src 'self'",
    script,
    // React writes style attributes on elements: they need 'unsafe-inline' (a nonce on style-src would turn it off); a style never runs code.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${MEDIA_CDN}`,
    `media-src 'self' ${MEDIA_CDN}`,
    "font-src 'self' data:",
    // The map's engine (MapLibre) runs its worker from a blob; its tiles and glyphs come through this origin (/maps/v1).
    "worker-src 'self' blob:",
    `connect-src 'self'${production ? "" : DEV_CONNECT}`,
    // The studio previews the page in a frame of its own origin; the three video platforms may fill a frame only after a visitor pressed a facade's button (nothing is framed before the click).
    `frame-src 'self' ${EMBED_FRAME_HOSTS.join(" ")}`,
    ...(strict ? ["manifest-src 'self'"] : []),
    "object-src 'none'",
    strict ? "base-uri 'none'" : "base-uri 'self'",
    appOrigin ? `form-action 'self' ${appOrigin}` : "form-action 'self'",
    appOrigin ? `frame-ancestors ${appOrigin}` : "frame-ancestors 'self'",
    ...(upgradeInsecure ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/** What a JSON-LD script holds: `<` escaped, so no value (a shop's name) can close the script element. */
export function jsonLdHtml(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}
