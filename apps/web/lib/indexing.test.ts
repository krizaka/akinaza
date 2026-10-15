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
    expect(CLOSED_ROBOTS).not.toContain("Sitemap");
    expect(NOINDEX).toBe("noindex, nofollow");
  });
});
