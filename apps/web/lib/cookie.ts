/**
 * The only place a cookie of the app is named and shaped (ADR-005 slice 1, akinaza#534). Shops live on sibling hosts of `www`, and any
 * script on one of them can toss a `Domain=akinaza.com` cookie that `www` would receive: so every cookie is host-locked with the
 * `__Host-` prefix (Secure, `Path=/`, no `Domain`), and none is ever given a `Domain`. A plain-http origin (CI, local) cannot take the
 * prefix and keeps the plain names.
 */
const production = process.env.NODE_ENV === "production";
const plainHttp = (process.env.APP_PUBLIC_URL ?? "").startsWith("http://");
const hostLocked = production && !plainHttp;

/** `akinaza_session` → `__Host-akinaza_session` where the browser can honour the prefix. */
export function cookieName(base: string): string {
  return hostLocked ? `__Host-${base}` : base;
}

export interface CookieOptions {
  httpOnly?: boolean;
  sameSite?: "lax" | "strict";
  maxAge?: number;
  expires?: Date;
}

/** A cookie to set: host-only (no `Domain`), `Path=/`, Secure in production. The shape `cookies().set` and `NextResponse.cookies.set` take. */
export function ownCookie(name: string, value: string, options: CookieOptions = {}) {
  const { httpOnly = true, sameSite = "lax", ...lifetime } = options;
  return { name, value, path: "/" as const, secure: production, httpOnly, sameSite, ...lifetime };
}

/** The same cookie, emptied: the attributes must match, or a `__Host-` one would be refused. */
export function expiredCookie(name: string) {
  return ownCookie(name, "", { maxAge: 0 });
}

/** A `Cookie` request header without the named cookies, whether the browser sent them plain or `__Host-` prefixed: what a shop's page is allowed to read (never the app's session). */
export function dropCookie(header: string | null, ...names: string[]): string {
  const dropped = new Set(names.flatMap((name) => [name.replace(/^__Host-/, ""), `__Host-${name.replace(/^__Host-/, "")}`]));
  return (header ?? "")
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => pair && !dropped.has(pair.split("=")[0]))
    .join("; ");
}
