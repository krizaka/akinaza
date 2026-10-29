import { readFileSync } from "node:fs";

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { proxy } from "../proxy";
import { isAllowedHost } from "./allowed-hosts";

const production = { NODE_ENV: "production", APP_PUBLIC_URL: "https://www.akinaza.com", APP_DEV_HOST: "dev.akinaza.com" };

/** ADR-005 slice 4 (#536): a request names only a host this deployment serves; any other answers 421, before anything is built from it. */
describe("the hosts a deployment serves", () => {
  it("the public host, its apex, the dev host, the console and a shop's own subdomain", () => {
    for (const host of ["www.akinaza.com", "akinaza.com", "dev.akinaza.com", "admin.akinaza.com", "pattes-saint-henri.akinaza.com", "WWW.Akinaza.com", "www.akinaza.com:443"]) {
      expect(isAllowedHost(host, production), host).toBe(true);
    }
  });
  it("nothing else: a stranger, a look-alike, a nested label, a platform name, an address, no host", () => {
    for (const host of ["evil.example", "akinaza.com.evil.example", "www.akinaza.com.evil.example", "evilakinaza.com", "a.b.akinaza.com", "ab.akinaza.com", "bad_slug.akinaza.com", "api.akinaza.com", "127.0.0.1", "[::1]", "localhost", "", null, undefined]) {
      expect(isAllowedHost(host, production), String(host)).toBe(false);
    }
  });
  it("no dev host declared, no dev host served", () => {
    expect(isAllowedHost("dev.akinaza.com", { ...production, APP_DEV_HOST: undefined })).toBe(false);
  });
  it("the deployment's own extra hosts (APP_ALLOWED_HOSTS), exactly", () => {
    const env = { ...production, APP_ALLOWED_HOSTS: "preview.example.org, other.example.org" };
    expect(isAllowedHost("preview.example.org", env)).toBe(true);
    expect(isAllowedHost("other.example.org:8080", env)).toBe(true);
    expect(isAllowedHost("x.preview.example.org", env)).toBe(false);
  });
  it("localhost only where it is declared or in development, never by default in production", () => {
    expect(isAllowedHost("localhost:3000", { NODE_ENV: "development", APP_PUBLIC_URL: "https://www.akinaza.com" })).toBe(true);
    expect(isAllowedHost("localhost:3000", { NODE_ENV: "production", APP_PUBLIC_URL: "http://localhost:3000" })).toBe(true);
    expect(isAllowedHost("localhost:3000", production)).toBe(false);
  });
});

afterEach(() => vi.unstubAllEnvs());

describe("the proxy answers an unknown host 421", () => {
  const at = (host: string, path = "/fr") => proxy(new NextRequest(`https://${host}${path}`, { headers: { host } }));
  it("on a page, an API call and a robots.txt, with no body that echoes the host", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_PUBLIC_URL", "https://www.akinaza.com");
    for (const path of ["/fr", "/fr/s/pattes", "/api/walker/shop", "/robots.txt", "/.well-known/assetlinks.json"]) {
      const response = at("evil.example", path);
      expect(response.status, path).toBe(421);
      expect(response.headers.get("x-robots-tag"), path).toBe("noindex, nofollow");
      expect(await response.text(), path).not.toContain("evil.example");
    }
  });
  it("lets the platform's own health check through, whatever host it names", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_PUBLIC_URL", "https://www.akinaza.com");
    expect(at("10.1.0.129:3000", "/api/healthz").status).toBe(200);
    expect(at("localhost:3000", "/api/healthz").status).toBe(200);
  });
  it("still serves the hosts it knows", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_PUBLIC_URL", "https://www.akinaza.com");
    expect(at("www.akinaza.com", "/fr").status).toBe(200);
    expect(at("pattes-saint-henri.akinaza.com", "/").status).toBe(200);
  });
});

describe("the servers CI starts", () => {
  it("each declares the origin it answers to (else the host guard answers its own crawler 421)", () => {
    for (const script of ["ci-after-build.sh", "ci-mobile-backend.sh", "ci-visual-start.sh"]) {
      expect(readFileSync(new URL(`../../../scripts/${script}`, import.meta.url), "utf8"), script).toMatch(/^export APP_PUBLIC_URL=http:\/\/localhost:3000/m);
    }
  });
});
