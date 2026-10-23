import { afterEach, describe, expect, it, vi } from "vitest";

import { announceSlots, realtimeBus, slotsTopic } from "./realtime";

describe("announceSlots", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("publishes only the constant invalidation on the shop's slots topic", async () => {
    vi.stubEnv("REALTIME_BUS", "memory");
    const seen: unknown[] = [];
    const off = realtimeBus().subscribe(slotsTopic("shop-1"), (event) => seen.push(event));
    await announceSlots("shop-1");
    off();
    expect(seen).toEqual([{ type: "slots.changed" }]);
  });

  it("never fails the booking that already committed when the bus is down", async () => {
    vi.stubEnv("REALTIME_BUS", "memory");
    const bus = realtimeBus();
    vi.spyOn(bus, "publish").mockRejectedValue(new Error("bus down"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(announceSlots("shop-1")).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
  });
});
