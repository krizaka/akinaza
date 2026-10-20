import { describe, expect, it } from "vitest";

import { CLOSED_ROBOTS, indexable, NOINDEX } from "./indexing";

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
    expect(CLOSED_ROBOTS).toContain("Sitemap: https://dev.akinaza.com/sitemap.xml");
    expect(NOINDEX).toBe("noindex, nofollow");
  });
});
