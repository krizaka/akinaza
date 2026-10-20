import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { proxy } from "../proxy";

const get = (path: string) => proxy(new NextRequest(`https://dev.akinaza.com${path}`, { headers: { host: "dev.akinaza.com" } }));

afterEach(() => vi.unstubAllEnvs());

describe("the proxy of a deployment closed to search engines (APP_SEARCH_INDEXING=off)", () => {
  it("noindexes every page, closes robots.txt (with its Sitemap line) and still serves the sitemap, noindexed", async () => {
    vi.stubEnv("APP_SEARCH_INDEXING", "off");
    expect(get("/en").headers.get("x-robots-tag")).toBe("noindex, nofollow");
    const robots = get("/robots.txt");
    expect(robots.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await robots.text()).toBe("User-agent: *\nDisallow: /\nSitemap: https://dev.akinaza.com/sitemap.xml\n");
    const sitemap = get("/sitemap.xml");
    expect(sitemap.status).toBe(200);
    expect(sitemap.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("leaves an open deployment alone", () => {
    expect(get("/en").headers.get("x-robots-tag")).toBeNull();
    expect(get("/sitemap.xml").status).toBe(200);
  });
});
