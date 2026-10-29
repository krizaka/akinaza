import { describe, expect, it } from "vitest";

import { shopPageProblems } from "./check-shop-host.mjs";

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
});
