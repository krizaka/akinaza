import crypto from "node:crypto";

import { type Platform } from "@akinaza/core";
import { addMinutes, isBefore } from "date-fns";

/**
 * The `state` of an OAuth round trip: it names the shop and the platform, expires, and is signed with the server's
 * key (given by the caller: the session secret) — so a callback can only complete a connection this server started, for
 * the shop that started it (no CSRF, no connecting an account to someone else's shop).
 */
// @fixed: how long the owner has on the platform's consent screen.
const TTL_MINUTES = 10;

const sign = (payload: string, key: string) => crypto.createHmac("sha256", `oauth-state:${key}`).update(payload).digest("base64url");

export function signState(input: { shopId: string; platform: Platform; now: Date }, key: string): string {
  const payload = Buffer.from(JSON.stringify({ s: input.shopId, p: input.platform, e: addMinutes(input.now, TTL_MINUTES).toISOString(), n: crypto.randomBytes(8).toString("hex") })).toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}

export function verifyState(state: string | null, expected: { shopId: string; platform: Platform; now: Date }, key: string): boolean {
  const [payload, mac] = (state ?? "").split(".");
  if (!payload || !mac) return false;
  const good = sign(payload, key);
  if (mac.length !== good.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good))) return false;
  try {
    const body = JSON.parse(Buffer.from(payload, "base64url").toString()) as { s: string; p: string; e: string };
    return body.s === expected.shopId && body.p === expected.platform && isBefore(expected.now, new Date(body.e));
  } catch {
    return false;
  }
}
