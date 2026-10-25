import { isDay, shiftDay, stripWindow, timeOf } from "./day";

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

describe("the day strip of Aujourd'hui (D8)", () => {
  it("shows two weeks around the day shown, three days before it", () => {
    expect(stripWindow("2026-10-20")).toEqual({ start: "2026-10-17", end: "2026-10-30" });
    expect(stripWindow("2026-12-30")).toEqual({ start: "2026-12-27", end: "2027-01-09" });
  });
});

describe("shiftDay is calendar arithmetic, never the machine's zone (akinaza#320)", () => {
  it.each([["2026-03-08", 1, "2026-03-09"], ["2026-11-01", 1, "2026-11-02"], ["2026-12-31", 1, "2027-01-01"], ["2028-03-01", -1, "2028-02-29"], ["2026-10-24", -3, "2026-10-21"]])("%s %i -> %s", (day, by, want) => expect(shiftDay(day, by)).toBe(want));
});
