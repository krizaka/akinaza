import { describe, expect, it } from "vitest";

import { leadsTo, shopPageProblems } from "./check-shop-host.mjs";

const ctx = { origin: "https://salon.akinaza.shop", appOrigin: "https://www.akinaza.com" };
const good = {
  status: 200,
  headers: {
    "content-security-policy": "default-src 'none'; script-src 'self' 'nonce-abc' 'strict-dynamic'; form-action 'self' https://www.akinaza.com; frame-ancestors https://www.akinaza.com",
    "x-robots-tag": "noindex, nofollow",
    "cache-control": "private, no-store",
  },
  body: '<link rel="canonical" href="https://salon.akinaza.shop/fr"/>',
};

describe("check-shop-host", () => {
  it("passes a shop page served as ADR-005 asks", () => {
    expect(shopPageProblems(good, ctx)).toEqual([]);
  });
  it("fails an inline-script policy, a session cookie, a Domain, a cacheable page and a canonical on the app", () => {
    const bad = {
      status: 200,
      headers: { ...good.headers, "content-security-policy": "script-src 'self' 'unsafe-inline'", "set-cookie": ["__Host-akinaza_session=x; Path=/", "a=1; Domain=akinaza.shop"], "cache-control": "public" },
      body: '<link rel="canonical" href="https://www.akinaza.com/fr/s/salon"/>',
    };
    const problems = shopPageProblems(bad, ctx).join("\n");
    for (const rule of ["script-src is not the strict one", "frame-ancestors", "form-action", "session cookie", "has a Domain", "can be cached", "canonical"]) expect(problems).toContain(rule);
  });
  it("a redirect leads to the app: absolute, or relative only where the app origin is the server's own (Next relativizes it)", () => {
    const target = "https://www.akinaza.com/fr/s/salon/service/1/confirm?slot=9";
    const answer = (location, status = 308) => ({ status, headers: { location } });
    expect(leadsTo(answer(target), target)).toBe(true);
    expect(leadsTo(answer("/fr/s/salon/service/1/confirm?slot=9"), target)).toBe(false);
    expect(leadsTo(answer("/fr/s/salon/service/1/confirm?slot=9"), target, { listenOrigin: "https://www.akinaza.com" })).toBe(true);
    expect(leadsTo(answer("/fr/s/salon/service/1/confirm?slot=9"), target, { listenOrigin: "http://localhost:3001" })).toBe(false);
    expect(leadsTo(answer("https://evil.example/fr/s/salon/service/1/confirm?slot=9"), target, { listenOrigin: "https://www.akinaza.com" })).toBe(false);
    expect(leadsTo(answer(target, 307), target)).toBe(false);
  });
});
