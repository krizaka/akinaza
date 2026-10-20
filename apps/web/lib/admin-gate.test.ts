import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { hostAllowed, ipAllowed } from "./access";
import { routeFor } from "./host";

/**
 * The administration's gate (Dev preview `admin.gated`): the console exists only on admin.akinaza.com, only for the
 * ADMIN role, and only from an address of AUTH_ALLOWED_IPS (nobody in production without a list). This test proves the
 * whole surface is behind it, not just one route: a new console page or admin API route that forgets the lock fails here.
 */
const root = path.join(__dirname, "..", "app");
const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => (statSync(path.join(dir, name)).isDirectory() ? walk(path.join(dir, name)) : [path.join(dir, name)]));
const read = (file: string) => readFileSync(file, "utf8");

describe("every administration API route takes the three locks", () => {
  const routes = walk(path.join(root, "api", "admin")).filter((f) => f.endsWith("route.ts"));
  it("has routes to guard", () => expect(routes.length).toBeGreaterThanOrEqual(6));
  for (const file of routes) {
    it(`${path.relative(root, file)} calls requireAdmin (session, ADMIN role, allowed address)`, () => {
      expect(read(file)).toMatch(/requireAdmin\(/);
    });
  }
});

describe("every console page is behind the signed layout (or is the sign-in, which checks the address itself)", () => {
  const consoleDir = path.join(root, "[locale]", "(admin)", "console");
  const pages = walk(consoleDir).filter((f) => f.endsWith("page.tsx"));
  const layout = read(path.join(consoleDir, "(signed)", "layout.tsx"));

  it("the signed layout answers 404 unless the visitor is an administrator on an allowed address", () => {
    expect(layout).toMatch(/pageAdmin\(\)/);
    expect(layout).toMatch(/notFound\(\)/);
  });

  for (const file of pages) {
    const rel = path.relative(consoleDir, file);
    if (rel.startsWith("sign-in")) {
      it(`${rel} 404s an address off the list`, () => expect(read(file)).toMatch(/ipAllowed\(.*\)[^\n]*notFound\(\)|!ipAllowed\(/));
    } else {
      it(`${rel} lives under (signed)`, () => expect(rel.startsWith("(signed)")).toBe(true));
    }
  }
});

describe("off the list, off the host", () => {
  const env = { NODE_ENV: "production", AUTH_ALLOWED_IPS: "203.0.113.7", ABUSE_CLIENT_IP_HEADER: "do-connecting-ip" };
  const from = (host: string, ip: string) => new Headers({ host, "do-connecting-ip": ip });

  it("the console is a 404 on the public host and the administration host refuses an address off the list", () => {
    expect(routeFor("dev.akinaza.com", "/en/console", "en")).toEqual({ kind: "notFound" });
    expect(hostAllowed(from("admin.akinaza.com", "198.51.100.9"), env)).toBe(false);
    expect(hostAllowed(from("admin.akinaza.com", "203.0.113.7"), env)).toBe(true);
  });

  it("with no list in production, nobody gets in", () => {
    expect(ipAllowed(from("admin.akinaza.com", "203.0.113.7"), { NODE_ENV: "production", ABUSE_CLIENT_IP_HEADER: "do-connecting-ip" })).toBe(false);
  });
});
