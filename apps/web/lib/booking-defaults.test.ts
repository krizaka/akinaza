import { bookingPreselect } from "@akinaza/core";
import { describe, expect, it } from "vitest";

import { bookingDefaults, searchValue } from "./booking-defaults";

const services = [{ id: "s1" }, { id: "s2" }];
const zones = [{ id: "z1" }, { id: "z2" }];
const dogs = [{ id: "d1" }];

describe("the booking flow opens with what the visitor chose on the page", () => {
  it("preselects the service, the area and the time of the address (a chip of the storefront)", () => {
    const pre = bookingPreselect({ service: "s2", zone: "z2", start: "2026-10-20T13:00:00Z" }, services, zones);
    expect(bookingDefaults({ services, zones, dogs, preselect: pre })).toEqual({ serviceId: "s2", zoneId: "z2", dogIds: ["d1"], startsAt: "2026-10-20T13:00:00.000Z" });
  });

  it("falls back to the first service and the first area when the address chose none — or chose something the shop does not offer", () => {
    expect(bookingDefaults({ services, zones, dogs, preselect: bookingPreselect({}, services, zones) })).toEqual({ serviceId: "s1", zoneId: "z1", dogIds: ["d1"], startsAt: "" });
    expect(bookingDefaults({ services, zones, dogs, preselect: bookingPreselect({ service: "x", zone: "y", start: "2026-10-20T13:00:00Z" }, services, zones) }).startsAt).toBe("");
  });

  it("needs no area for a shop without zones, and does not guess between several dogs", () => {
    const d = bookingDefaults({ services, zones: [], dogs: [{ id: "a" }, { id: "b" }], preselect: bookingPreselect({ service: "s2" }, services, []) });
    expect(d).toEqual({ serviceId: "s2", zoneId: "", dogIds: [], startsAt: "" });
  });

  it("reads one value of a query string, the first when it repeats", () => {
    expect(searchValue("a")).toBe("a");
    expect(searchValue(["a", "b"])).toBe("a");
    expect(searchValue(undefined)).toBeNull();
  });
});
