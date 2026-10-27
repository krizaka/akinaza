import { describe, expect, it } from "vitest";

import { feedTokenHash, feedUrl, isFeedToken, newFeedToken, tokenOfSegment } from "./feed-token";
import { tokenHash } from "./session";

describe("the secret of a private calendar feed (ADR-004)", () => {
  it("is 256 random bits, different every time, in a recognisable shape", () => {
    const a = newFeedToken();
    expect(a).toMatch(/^kf1\.[A-Za-z0-9_-]{43}$/);
    expect(newFeedToken()).not.toBe(a);
    expect(isFeedToken(a)).toBe(true);
    expect(isFeedToken("kf1.short")).toBe(false);
    expect(isFeedToken("as1." + a.slice(4))).toBe(false);
  });

  it("is stored as a keyed hash that is not the session's, and never as the token", () => {
    const token = newFeedToken();
    const hash = feedTokenHash(token, "secret");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token.slice(4, 20));
    expect(feedTokenHash(token, "other")).not.toBe(hash);
    expect(tokenHash(token, "secret")).not.toBe(hash);
  });

  it("is in the path, with or without the .ics a calendar app likes", () => {
    const token = newFeedToken();
    expect(feedUrl("https://www.akinaza.com/", token)).toBe(`https://www.akinaza.com/api/feed/${token}.ics`);
    expect(tokenOfSegment(`${token}.ics`)).toBe(token);
    expect(tokenOfSegment(token)).toBe(token);
    expect(tokenOfSegment("agenda.ics")).toBeNull();
  });
});
