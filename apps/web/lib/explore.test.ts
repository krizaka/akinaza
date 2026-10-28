import type { ExploreShop } from "@akinaza/core";
import { describe, expect, it } from "vitest";

import { distanceLabel, mapCenter } from "./explore";

const shop = (point: [number, number] | null): ExploreShop => ({ slug: "s", name: "S", kind: "salon", area: null, taglineFr: null, taglineEn: null, quartiers: [], point, openNow: false, freeToday: false });

describe("distance said to the visitor", () => {
  it("in metres under a kilometre (rounded to ten) and in kilometres above, in the language", () => {
    expect(distanceLabel(347, "en")).toBe("350 m");
    expect(distanceLabel(3, "en")).toBe("10 m");
    expect(distanceLabel(1234, "en")).toBe("1.2 km");
    expect(distanceLabel(1234, "fr")).toBe("1,2 km");
  });
});

describe("the map's first view", () => {
  it("is the origin when there is one, else the middle of the shops, else Montréal", () => {
    expect(mapCenter([shop([-73.6, 45.4])], { point: [-73.5, 45.5], label: null })).toEqual([-73.5, 45.5]);
    expect(mapCenter([shop([-73.6, 45.4]), shop([-73.4, 45.6])], null)).toEqual([-73.5, 45.5]);
    expect(mapCenter([shop(null)], null)).toEqual([-73.5673, 45.5017]);
  });
});
