import { describe, expect, it } from "vitest";

import { mergeBusy, nextSyncDelayMinutes, overlapsBusy } from "./source";
import { parseBusy } from "./ics-busy";

const wrap = (...events: string[]) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events.map((e) => `BEGIN:VEVENT\r\n${e}\r\nEND:VEVENT\r\n`).join("")}END:VCALENDAR\r\n`;
const range = { from: new Date("2026-10-26T00:00:00Z"), to: new Date("2026-11-30T00:00:00Z"), timezone: "America/Toronto" };
const iso = (b: { startsAt: Date; endsAt: Date }) => [b.startsAt.toISOString(), b.endsAt.toISOString()];

describe("the busy times of an ICS file (ADR-004)", () => {
  it("reads UTC, zoned and floating times, in the shop's zone when none is said", () => {
    const busy = parseBusy(
      wrap("UID:a\r\nDTSTART:20261027T140000Z\r\nDTEND:20261027T150000Z", "UID:b\r\nDTSTART;TZID=America/Toronto:20261028T090000\r\nDTEND;TZID=America/Toronto:20261028T100000", "UID:c\r\nDTSTART:20261029T090000\r\nDURATION:PT30M"),
      range,
    );
    expect(busy.map(iso)).toEqual([
      ["2026-10-27T14:00:00.000Z", "2026-10-27T15:00:00.000Z"],
      ["2026-10-28T13:00:00.000Z", "2026-10-28T14:00:00.000Z"],
      ["2026-10-29T13:00:00.000Z", "2026-10-29T13:30:00.000Z"],
    ]);
  });

  it("an all-day event blocks the shop's local day; a transparent or cancelled event blocks nothing", () => {
    const busy = parseBusy(wrap("UID:a\r\nDTSTART;VALUE=DATE:20261030\r\nDTEND;VALUE=DATE:20261031", "UID:b\r\nDTSTART:20261030T150000Z\r\nDTEND:20261030T160000Z\r\nTRANSP:TRANSPARENT", "UID:c\r\nDTSTART:20261030T150000Z\r\nDTEND:20261030T160000Z\r\nSTATUS:CANCELLED"), range);
    expect(busy.map(iso)).toEqual([["2026-10-30T04:00:00.000Z", "2026-10-31T04:00:00.000Z"]]);
  });

  it("expands a weekly rule with BYDAY, keeping the wall-clock hour across the daylight-saving change", () => {
    const busy = parseBusy(wrap("UID:w\r\nDTSTART;TZID=America/Toronto:20261026T180000\r\nDTEND;TZID=America/Toronto:20261026T190000\r\nRRULE:FREQ=WEEKLY;BYDAY=MO,TH;COUNT=4"), range);
    expect(busy.map((b) => b.startsAt.toISOString())).toEqual(["2026-10-26T22:00:00.000Z", "2026-10-29T22:00:00.000Z", "2026-11-02T23:00:00.000Z", "2026-11-05T23:00:00.000Z"]);
  });

  it("honours EXDATE, UNTIL and a moved instance (RECURRENCE-ID)", () => {
    const busy = parseBusy(
      wrap(
        "UID:d\r\nDTSTART:20261026T120000Z\r\nDTEND:20261026T130000Z\r\nRRULE:FREQ=DAILY;UNTIL=20261030T235959Z\r\nEXDATE:20261027T120000Z",
        "UID:d\r\nRECURRENCE-ID:20261028T120000Z\r\nDTSTART:20261028T200000Z\r\nDTEND:20261028T210000Z",
      ),
      range,
    );
    expect(busy.map((b) => b.startsAt.toISOString())).toEqual(["2026-10-26T12:00:00.000Z", "2026-10-28T20:00:00.000Z", "2026-10-29T12:00:00.000Z", "2026-10-30T12:00:00.000Z"]);
  });

  it("keeps only what touches the window, unfolds long lines, skips what is malformed and never reads a title", () => {
    const busy = parseBusy(wrap("UID:old\r\nDTSTART:20200101T120000Z\r\nDTEND:20200101T130000Z", "UID:bad\r\nDTSTART:not-a-date", "UID:ok\r\nSUMMARY:Dentist with a very long title that is\r\n  folded\r\nDTSTART:20261101T120000Z\r\nDTEND:20261101T130000Z"), range);
    expect(busy).toHaveLength(1);
    expect(JSON.stringify(busy)).not.toContain("Dentist");
  });

  it("an open-ended rule started years ago stays bounded by the window", () => {
    const busy = parseBusy(wrap("UID:y\r\nDTSTART:20200101T120000Z\r\nDTEND:20200101T130000Z\r\nRRULE:FREQ=DAILY"), range);
    expect(busy).toHaveLength(35);
    expect(busy.at(-1)!.startsAt.toISOString()).toBe("2026-11-29T12:00:00.000Z");
  });
});

describe("busy intervals", () => {
  const at = (h: number) => new Date(Date.UTC(2026, 9, 27, h));
  it("merges overlapping and touching intervals", () => {
    expect(mergeBusy([{ startsAt: at(12), endsAt: at(13) }, { startsAt: at(9), endsAt: at(10) }, { startsAt: at(10), endsAt: at(11) }, { startsAt: at(12), endsAt: at(12) }]).map(iso)).toEqual([[at(9).toISOString(), at(11).toISOString()], [at(12).toISOString(), at(13).toISOString()]]);
  });
  it("touching ends do not overlap", () => {
    expect(overlapsBusy(at(10), at(11), [{ startsAt: at(11), endsAt: at(12) }])).toBe(false);
    expect(overlapsBusy(at(10), at(11), [{ startsAt: at(10), endsAt: at(10) }, { startsAt: at(10), endsAt: at(11) }])).toBe(true);
  });
  it("backs off at each failure and stops at a day", () => {
    expect([0, 1, 2, 3].map((n) => nextSyncDelayMinutes(30, n))).toEqual([30, 60, 120, 240]);
    expect(nextSyncDelayMinutes(30, 20)).toBe(1_440);
  });
});
