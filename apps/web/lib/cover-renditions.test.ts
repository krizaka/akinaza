import { describe, expect, it } from "vitest";

import { coverSizes, coverSrcSet } from "./cover-renditions";

const CDN = "https://krizaka-assets.b-cdn.net/sites/akinaza/demo";

describe("cover renditions (akinaza#459)", () => {
  it("gives the demo covers three widths, the middle one for a phone", () => {
    const set = coverSrcSet(`${CDN}/salon-cover.dfc17581a8.webp`)!;
    expect(set.split(", ")).toHaveLength(3);
    expect(set).toContain("400w");
    expect(set).toContain("1200w");
  });
  it("leaves a shop's own cover as it is", () => {
    expect(coverSrcSet("https://example.com/own.webp")).toBeUndefined();
  });
  it("sizes the split hero as a column and the others full width", () => {
    expect(coverSizes("split")).toContain("32rem");
    expect(coverSizes("poster")).toBe("100vw");
  });
});
