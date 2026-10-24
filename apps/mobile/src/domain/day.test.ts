import { isDay, shiftDay, timeOf } from "./day";

describe("the owner's day", () => {
  it.each([["2026-10-20", true], ["2028-02-29", true], ["2026-02-30", false], ["2026-10", false], ["", false], [undefined, false]])("reads %j as a day: %s", (value, ok) => expect(isDay(value as string | undefined)).toBe(ok));

  it("steps across month and year ends", () => {
    expect(shiftDay("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDay("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("draws an instant on the shop's clock, not the phone's", () => {
    // Québec French writes « 09 h 00 » (newer ICU data), English « 09:00 »: the hour is the shop's either way.
    expect(timeOf("2026-10-20T13:00:00.000Z", "America/Toronto", "fr-CA")).toMatch(/^09( h |:)00$/);
    expect(timeOf("2026-10-20T13:00:00.000Z", "UTC", "fr-CA")).toMatch(/^13( h |:)00$/);
    expect(timeOf("2026-10-20T13:00:00.000Z", "America/Toronto", "en-CA")).toBe("09:00");
  });
});
