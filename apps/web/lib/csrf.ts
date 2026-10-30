const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Fetch-Metadata check for the writes of the API (ADR-005 slice 1, akinaza#534). `SameSite=Lax` does not stop a request from a shop host
 * (same site as `www`), so a write that may carry the web session must say it comes from this origin: `Sec-Fetch-Site: same-origin`, else (an
 * older browser) an `Origin` equal to the configured app origin. A bearer (the apps) cannot be forged by a form and is left alone; so is
 * a script or a webhook that carries no session cookie. A request that carries the session cookie but says where it comes from nowhere is
 * refused: a browser always says. Pure, so every case is tested without a server.
 */
export function refusesCrossSiteWrite({ method, headers, origin, sessionCookie }: { method: string; headers: Headers; origin: string; sessionCookie: string }): boolean {
  if (SAFE.has(method.toUpperCase())) return false;
  if (/^bearer\s/i.test(headers.get("authorization") ?? "")) return false;
  const site = headers.get("sec-fetch-site");
  if (site) return site !== "same-origin";
  const from = headers.get("origin");
  if (from) return from !== origin.replace(/\/$/, "");
  return (headers.get("cookie") ?? "").split(";").some((c) => c.trim().startsWith(`${sessionCookie}=`));
}
