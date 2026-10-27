import crypto from "node:crypto";

/**
 * The secret in a private calendar feed's address (ADR-004): `kf1.` and 32 random bytes (256 bits). It is shown once, when the feed is made or
 * rotated; only its keyed hash is stored, so a leaked table opens no feed. The key (the session secret, handed in by the route) is not used as the session's: a hash of one kind never matches the other.
 */
const TOKEN = /^kf1\.[A-Za-z0-9_-]{43}$/;

export const newFeedToken = () => `kf1.${crypto.randomBytes(32).toString("base64url")}`;
export const isFeedToken = (value: string): boolean => TOKEN.test(value);
export const feedTokenHash = (token: string, secret: string) => crypto.createHmac("sha256", `feed:${secret}`).update(token).digest("hex");

/** The address a calendar app subscribes to. The token is in the path, never in a query string (logs, referrers). */
export const feedUrl = (publicUrl: string, token: string) => `${publicUrl.replace(/\/$/, "")}/api/feed/${token}.ics`;

/** The token of an address segment, with the `.ics` a calendar app likes; anything else is not a token. */
export const tokenOfSegment = (segment: string): string | null => {
  const bare = segment.endsWith(".ics") ? segment.slice(0, -4) : segment;
  return isFeedToken(bare) ? bare : null;
};
