import { describe, expect, it } from "vitest";

import { availablePlatforms, connectorFor } from "./connectors";

describe("connectors", () => {
  it("are off unless the environment says fake", () => {
    expect(connectorFor("google", "off")).toBeNull();
    expect(availablePlatforms("off")).toEqual([]);
    expect(connectorFor("google", "fake")?.platform).toBe("google");
    expect(availablePlatforms("fake")).toEqual(["google", "facebook", "instagram"]);
  });
  it("know no other platform (Apple, Yelp and Bing have no API)", () => {
    for (const p of ["apple", "yelp", "bing", "tiktok"]) expect(connectorFor(p, "fake")).toBeNull();
  });
});
