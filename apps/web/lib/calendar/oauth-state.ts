import crypto from "node:crypto";

import type { CalendarKind } from "@akinaza/core";

/** The providers the owner consents to at their own site (OAuth); the others are an address or a credential given here. */
export const OAUTH_KINDS = ["google", "outlook"] as const satisfies readonly CalendarKind[];
export type OAuthKind = (typeof OAUTH_KINDS)[number];
export const isOAuthKind = (value: string): value is OAuthKind => (OAUTH_KINDS as readonly string[]).includes(value);

// @fixed: how long the owner has at the provider's consent screen before the round trip is void (OAuth state, RFC 6749 section 10.12)
export const STATE_TTL_SECONDS = 600;

/** What the round trip to the provider must bring back, signed: whose calendar, for whom, and the words agreed to. Never a token. */
export interface OAuthState {
  kind: OAuthKind;
  shopId: string;
  staffId: string | null;
  accountId: string;
  label: string;
  locale: string;
  /** Ties the signed state to the PKCE cookie of the same browser. */
  nonce: string;
  /** Seconds since the epoch. */
  expires: number;
}

const mac = (body: string, secret: string) => crypto.createHmac("sha256", `calendar-oauth:${secret}`).update(body).digest("base64url");
const seconds = (at: Date) => Math.floor(at.valueOf() / 1000);

export function signState(state: Omit<OAuthState, "expires" | "nonce">, secret: string, now: Date): { state: string; nonce: string } {
  const nonce = crypto.randomBytes(16).toString("base64url");
  const body = Buffer.from(JSON.stringify({ ...state, nonce, expires: seconds(now) + STATE_TTL_SECONDS } satisfies OAuthState)).toString("base64url");
  return { state: `${body}.${mac(body, secret)}`, nonce };
}

/** The state if it is ours, whole and not expired; `null` otherwise (a forged, altered or stale one is never explained). */
export function verifyState(token: string, secret: string, now: Date): OAuthState | null {
  const [body, signature, ...rest] = token.split(".");
  if (!body || !signature || rest.length > 0) return null;
  const expected = Buffer.from(mac(body, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const state = JSON.parse(Buffer.from(body, "base64url").toString()) as OAuthState;
    return isOAuthKind(state.kind) && typeof state.nonce === "string" && state.expires > seconds(now) ? state : null;
  } catch {
    return null;
  }
}

/** A PKCE pair (RFC 7636, S256): the verifier stays in the browser's cookie, only the challenge goes to the provider. */
export function newPkce(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(48).toString("base64url");
  return { verifier, challenge: crypto.createHash("sha256").update(verifier).digest("base64url") };
}

export const PKCE_COOKIE = "akinaza_cal_pkce";
export const pkceCookie = (nonce: string, verifier: string, secure: boolean) =>
  `${PKCE_COOKIE}=${nonce}.${verifier}; Path=/api/calendars/callback; HttpOnly; SameSite=Lax; Max-Age=${STATE_TTL_SECONDS}${secure ? "; Secure" : ""}`;
export const clearPkceCookie = (secure: boolean) => `${PKCE_COOKIE}=; Path=/api/calendars/callback; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;

/** The verifier of the browser's cookie, if it belongs to this state's nonce. */
export function verifierFor(cookieHeader: string | null, nonce: string): string | null {
  const raw = cookieHeader?.split(/;\s*/).find((c) => c.startsWith(`${PKCE_COOKIE}=`))?.slice(PKCE_COOKIE.length + 1);
  const [given, verifier] = raw?.split(".") ?? [];
  return given === nonce && verifier ? verifier : null;
}
