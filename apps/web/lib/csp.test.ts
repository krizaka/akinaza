import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CAPTCHA_HOST, contentSecurityPolicy, isGuestStepPath, isShopPath, jsonLdHtml, newNonce, upgradesInsecure } from "./csp";

const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `))?.split(" ").slice(1) ?? [];
const opts = { production: true, upgradeInsecure: true };

/** Loi 25: a page frames a third party only for the three video platforms, and a script, a font or a connection never goes to one (B45, #312). */
describe.each([
  ["the static policy", undefined],
  ["the strict policy", "bm9uY2U="],
])("%s", (_name, nonce) => {
  const csp = contentSecurityPolicy({ ...opts, nonce });
  it("frames this origin (the studio's preview) and the three embed hosts, nothing else", () => {
    expect(directive(csp, "frame-src").sort()).toEqual(["'self'", "https://www.instagram.com", "https://www.tiktok.com", "https://www.youtube-nocookie.com"].sort());
  });
  it("lets no third party run a script, load a font or answer a request", () => {
    for (const name of ["script-src", "font-src", "connect-src", "default-src", "object-src"]) {
      expect(directive(csp, name).filter((source) => source.startsWith("https://") && !source.includes("krizaka-assets")), name).toEqual([]);
    }
  });
  it("still refuses to be framed by anyone but itself, and closes <base> and forms to this origin", () => {
    expect(directive(csp, "frame-ancestors")).toEqual(["'self'"]);
    expect(directive(csp, "base-uri")).toEqual(nonce ? ["'none'"] : ["'self'"]);
    expect(directive(csp, "form-action")).toEqual(["'self'"]);
    expect(directive(csp, "object-src")).toEqual(["'none'"]);
  });
});

/** ADR-005 slice 3 (#535): the shop pages run no script that does not carry the response's nonce. */
describe("the strict policy of the shop pages", () => {
  const csp = contentSecurityPolicy({ ...opts, nonce: "bm9uY2U=" });
  it("denies by default, and allows a script only by nonce (strict-dynamic), never inline", () => {
    expect(directive(csp, "default-src")).toEqual(["'none'"]);
    expect(directive(csp, "script-src")).toEqual(["'self'", "'nonce-bm9uY2U='", "'strict-dynamic'"]);
    expect(directive(csp, "script-src")).not.toContain("'unsafe-inline'");
    expect(directive(csp, "script-src")).not.toContain("'unsafe-eval'");
  });
  it("keeps what the page draws: its own styles, its images, its media, the map's worker", () => {
    expect(directive(csp, "style-src")).toEqual(["'self'", "'unsafe-inline'"]);
    expect(directive(csp, "img-src")).toContain("https://krizaka-assets.b-cdn.net");
    expect(directive(csp, "media-src")).toContain("https://krizaka-assets.b-cdn.net");
    expect(directive(csp, "worker-src")).toEqual(["'self'", "blob:"]);
    expect(directive(csp, "manifest-src")).toEqual(["'self'"]);
  });
  it("lets the dev server eval, never production", () => {
    expect(directive(contentSecurityPolicy({ production: false, upgradeInsecure: false, nonce: "n" }), "script-src")).toContain("'unsafe-eval'");
  });
  it("is the only one with a nonce: the static policy keeps its inline bootstrap", () => {
    expect(directive(contentSecurityPolicy(opts), "script-src")).toEqual(["'self'", "'unsafe-inline'"]);
  });
});

describe("the nonce", () => {
  it("is fresh for every response and unguessable (a base64 UUID)", () => {
    const seen = new Set(Array.from({ length: 50 }, newNonce));
    expect(seen.size).toBe(50);
    for (const nonce of seen) expect(nonce).toMatch(/^[A-Za-z0-9+/]{40,}=*$/);
  });
});

describe("upgrade-insecure-requests", () => {
  it("is read per request: https and undeclared origins keep it, a plain-http one (the CI server) and development drop it", () => {
    expect(upgradesInsecure(true, "https://www.akinaza.com")).toBe(true);
    expect(upgradesInsecure(true, undefined)).toBe(true);
    expect(upgradesInsecure(true, "http://localhost:3000")).toBe(false);
    expect(upgradesInsecure(false, undefined)).toBe(false);
    expect(contentSecurityPolicy({ production: true, upgradeInsecure: false })).not.toContain("upgrade-insecure-requests");
    expect(contentSecurityPolicy(opts)).toContain("upgrade-insecure-requests");
  });
});

describe("which pages are strict", () => {
  it("the public shop pages in both languages, not the app, the explorer or the API", () => {
    expect(isShopPath("/fr/s/pattes-saint-henri")).toBe(true);
    expect(isShopPath("/en/s/pattes/service/abc/slots")).toBe(true);
    expect(isShopPath("/es/s/pattes")).toBe(true);
    for (const path of ["/fr", "/fr/app", "/fr/explore", "/fr/shop", "/en/sx", "/api/s/x", "/s/x"]) expect(isShopPath(path), path).toBe(false);
  });
});

describe("the one inline script of a shop page", () => {
  it("is the theme script, and the layout hands it the response's nonce", () => {
    const layout = readFileSync(new URL("../app/[locale]/layout.tsx", import.meta.url), "utf8");
    expect(layout).toContain('get("x-nonce")');
    expect(layout).toContain("<ThemeScript defaultMode=\"dark\" nonce={nonce} />");
  });
});

describe("JSON-LD", () => {
  it("escapes < so a value can never close the script element", () => {
    const html = jsonLdHtml({ name: "</script><script>alert(1)</script>" });
    expect(html).not.toContain("<");
    expect(JSON.parse(html)).toEqual({ name: "</script><script>alert(1)</script>" });
  });
  it("is what every page uses: no raw JSON.stringify into dangerouslySetInnerHTML", () => {
    const pages = ["docs/[page]", "docs", "download", "explore", "", "pricing", "privacy", "terms"].map((p) => `../app/[locale]/${p ? `${p}/` : ""}page.tsx`);
    for (const page of pages) expect(readFileSync(new URL(page, import.meta.url), "utf8"), page).not.toContain("__html: JSON.stringify");
  });
});

describe("a shop on its own domain (ADR-005 §6, akinaza#538)", () => {
  const csp = contentSecurityPolicy({ ...opts, nonce: "bm9uY2U=", appOrigin: "https://www.akinaza.com" });
  it("may submit to the app (the booking hop) and be framed only by the app (the studio's preview), nobody else", () => {
    expect(directive(csp, "form-action")).toEqual(["'self'", "https://www.akinaza.com"]);
    expect(directive(csp, "frame-ancestors")).toEqual(["https://www.akinaza.com"]);
  });
  it("stays the strict policy: a nonce, no inline script", () => {
    expect(directive(csp, "script-src")).not.toContain("'unsafe-inline'");
    expect(directive(csp, "script-src")).toContain("'nonce-bm9uY2U='");
    expect(directive(csp, "default-src")).toEqual(["'none'"]);
  });
});

describe("the guest booking step's bot check", () => {
  it("names Cloudflare for its script, frame and call on that one page, and nowhere else", () => {
    const csp = contentSecurityPolicy({ ...opts, nonce: "bm9uY2U=", captcha: true });
    for (const name of ["script-src", "frame-src", "connect-src"]) expect(directive(csp, name), name).toContain(CAPTCHA_HOST);
    expect(directive(csp, "font-src")).not.toContain(CAPTCHA_HOST);
    expect(contentSecurityPolicy({ ...opts, nonce: "bm9uY2U=" })).not.toContain(CAPTCHA_HOST);
  });

  it("is the confirm step of a service, in any language, and no other path", () => {
    expect(isGuestStepPath("/fr/s/pattes/service/abc/confirm")).toBe(true);
    expect(isGuestStepPath("/en/s/pattes/service/abc/confirm/")).toBe(true);
    expect(isGuestStepPath("/en/s/pattes/service/abc/confirmation")).toBe(false);
    expect(isGuestStepPath("/en/s/pattes")).toBe(false);
  });
});
