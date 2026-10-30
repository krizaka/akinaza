import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { contentSecurityPolicy } from "./csp";

const config = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");

describe("the map of a shop page", () => {
  it("reads its tiles and glyphs through this origin: the media CDN sends no CORS headers", () => {
    expect(config).toContain('source: "/maps/v1/:path*"');
    expect(config).toContain("https://krizaka-assets.b-cdn.net/org/v1/maps/:path*");
  });
  it("lets its engine run its worker from a blob, and nothing else", () => {
    for (const nonce of [undefined, "bm9uY2U="]) {
      const csp = contentSecurityPolicy({ nonce, production: true, upgradeInsecure: true });
      expect(csp).toContain("worker-src 'self' blob:");
      expect(csp).toContain("connect-src 'self';"); // the tiles are same-origin: no third-party connection is opened
      expect(csp).not.toMatch(/connect-src[^;]*https:\/\/krizaka-assets/);
    }
  });
});

describe("the map engine's worker", () => {
  it("is served by this site, not by a third-party CDN: the map points at /maplibre and the route serves the two files", () => {
    const zone = readFileSync(new URL("../components/shop/MapSetup.tsx", import.meta.url), "utf8");
    expect(zone).toContain('workerUrl: "/maplibre/maplibre-gl-worker.mjs"');
    const route = readFileSync(new URL("../app/maplibre/[file]/route.ts", import.meta.url), "utf8");
    expect(route).toContain("maplibre-gl-worker.mjs");
    expect(route).toContain("maplibre-gl-shared.mjs");
    expect(route).toContain('dynamic = "force-static"');
    expect(config).not.toContain("jsdelivr");
  });
});
