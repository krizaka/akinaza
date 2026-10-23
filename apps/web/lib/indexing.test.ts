import { describe, expect, it } from "vitest";

import { CLOSED_ROBOTS, closedRobots, devRedirect, indexable, indexableOn, isDevHost, NOINDEX, publicHost } from "./indexing";

describe("APP_SEARCH_INDEXING", () => {
  it("is open by default and closed only by an exact off", () => {
    expect(indexable({})).toBe(true);
    expect(indexable({ APP_SEARCH_INDEXING: "on" })).toBe(true);
    expect(indexable({ APP_SEARCH_INDEXING: "off" })).toBe(false);
    expect(indexable({ APP_SEARCH_INDEXING: " OFF " })).toBe(false);
  });

  it("closes robots.txt to everyone", () => {
    expect(CLOSED_ROBOTS).toContain("Disallow: /");
    // The family contract (AGENTS.md of krizaka-com §2.4): a closed site still serves correct files for the day it opens.
    expect(CLOSED_ROBOTS).toContain("Sitemap: https://www.akinaza.com/sitemap.xml");
    expect(NOINDEX).toBe("noindex, nofollow");
  });
});

const ENV = { APP_SEARCH_INDEXING: "off", APP_PUBLIC_URL: "https://www.akinaza.com", APP_DEV_HOST: "dev.akinaza.com" };

describe("the public host is indexed, the dev host never (epic krizaka/.github#119)", () => {
  it("a closed deployment (off) stays closed everywhere but on the host of APP_PUBLIC_URL", () => {
    expect(publicHost(ENV)).toBe("www.akinaza.com");
    expect(indexableOn("www.akinaza.com", ENV)).toBe(true);
    expect(indexableOn("WWW.akinaza.com:443", ENV)).toBe(true);
    expect(indexableOn("dev.akinaza.com", ENV)).toBe(false);
    expect(indexableOn("admin.akinaza.com", ENV)).toBe(false);
    expect(indexableOn("anything.test", ENV)).toBe(false);
  });

  it("a dev.* host is never indexable, whatever the configuration says (#249)", () => {
    for (const config of [{ APP_SEARCH_INDEXING: "on" }, {}, { APP_PUBLIC_URL: "https://dev.akinaza.com" }, { APP_DEV_HOST: "other.test" }]) {
      expect(indexableOn("dev.akinaza.com", config)).toBe(false);
      expect(indexableOn("DEV.akinaza.com:443", config)).toBe(false);
    }
    expect(indexableOn("www.akinaza.com", { APP_SEARCH_INDEXING: "on" })).toBe(true);
  });

  it("the dev host is the one APP_DEV_HOST names", () => {
    expect(isDevHost("dev.akinaza.com", ENV)).toBe(true);
    expect(isDevHost("www.akinaza.com", ENV)).toBe(false);
    expect(isDevHost("dev.akinaza.com", {})).toBe(false);
  });

  it("on the dev host every HTML page goes to www (308 target, same path and query); the API, auth, webhooks, .well-known, healthz and robots stay", () => {
    const go = (path: string, method = "GET") => devRedirect(method, path.split("?")[0]!, path.includes("?") ? `?${path.split("?")[1]}` : "", "https://www.akinaza.com");
    expect(go("/en")).toBe("https://www.akinaza.com/en");
    expect(go("/en/sign-in?next=%2Fapp")).toBe("https://www.akinaza.com/en/sign-in?next=%2Fapp");
    expect(go("/")).toBe("https://www.akinaza.com/");
    expect(go("/sitemap.xml")).toBe("https://www.akinaza.com/sitemap.xml");
    expect(go("/en", "HEAD")).toBe("https://www.akinaza.com/en");
    for (const stay of ["/api/healthz", "/api/internal/sync", "/api/auth/callback", "/.well-known/assetlinks.json", "/healthz", "/robots.txt"]) expect(go(stay), stay).toBeNull();
    expect(go("/en/sign-in", "POST")).toBeNull();
    expect(go("/apix")).toBe("https://www.akinaza.com/apix");
  });

  it("the dev host's robots.txt closes everything and names no sitemap", () => {
    expect(closedRobots(undefined)).toBe("User-agent: *\nDisallow: /\n");
  });
});
