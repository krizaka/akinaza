import { describe, expect, it } from "vitest";

import { refusesCrossSiteWrite } from "./csrf";

const ORIGIN = "https://www.akinaza.com";
const ask = (method: string, headers: Record<string, string>) => refusesCrossSiteWrite({ method, headers: new Headers(headers), origin: ORIGIN, sessionCookie: "__Host-akinaza_session" });

/** ADR-005 slice 1 (akinaza#534): a write that carries the session must come from the app itself. */
describe("the same-origin check on writes", () => {
  it("never looks at a read", () => {
    expect(ask("GET", { "sec-fetch-site": "cross-site" })).toBe(false);
    expect(ask("HEAD", { "sec-fetch-site": "same-site" })).toBe(false);
  });
  it("accepts a browser write from the app's own origin", () => {
    expect(ask("POST", { "sec-fetch-site": "same-origin" })).toBe(false);
    expect(ask("DELETE", { origin: ORIGIN })).toBe(false);
  });
  it("refuses a write from another site, a sibling subdomain (a shop host is same-site), or a null origin", () => {
    expect(ask("POST", { "sec-fetch-site": "cross-site" })).toBe(true);
    expect(ask("POST", { "sec-fetch-site": "same-site" })).toBe(true);
    expect(ask("PATCH", { "sec-fetch-site": "none" })).toBe(true);
    expect(ask("POST", { origin: "https://pattes.akinaza.com" })).toBe(true);
    expect(ask("POST", { origin: "null" })).toBe(true);
    // Sec-Fetch-Site wins over an Origin that looks right.
    expect(ask("POST", { "sec-fetch-site": "cross-site", origin: ORIGIN })).toBe(true);
  });
  it("leaves the non-browser clients alone: a bearer, a webhook, a script with no cookie", () => {
    expect(ask("POST", { authorization: "Bearer abc" })).toBe(false);
    expect(ask("POST", { authorization: "Bearer abc", cookie: "__Host-akinaza_session=x", "sec-fetch-site": "cross-site" })).toBe(false);
    expect(ask("POST", {})).toBe(false);
    expect(ask("POST", { cookie: "__Host-NEXT_LOCALE=fr" })).toBe(false);
  });
  it("refuses a write that carries the session and says where it comes from nowhere", () => {
    expect(ask("POST", { cookie: "a=b; __Host-akinaza_session=x" })).toBe(true);
  });
});
