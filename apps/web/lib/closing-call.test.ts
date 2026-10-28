import { describe, expect, it } from "vitest";

import { nextFreeTime } from "./closing-call";
import type { DayView } from "./storefront";

const day = (id: string, label: string, times: string[]): DayView => ({ id, label, sub: "", slots: times.map((t) => ({ id: `${id}T${t}`, label: t, href: `/book?at=${id}T${t}` })) });

describe("the closing call's next free time", () => {
  it("is the first time of the first day that has one", () => {
    expect(nextFreeTime([day("d1", "Today", ["16:30", "17:00"]), day("d2", "Tomorrow", ["9:00"])])).toEqual({ id: "d1T16:30", label: "Today 16:30", href: "/book?at=d1T16:30" });
  });
  it("skips a closed day: the next opening's time is shown", () => {
    expect(nextFreeTime([day("d1", "Today", []), day("d2", "Tomorrow", ["9:00"])])?.label).toBe("Tomorrow 9:00");
  });
  it("is absent when nothing is free", () => {
    expect(nextFreeTime([day("d1", "Today", [])])).toBeUndefined();
    expect(nextFreeTime([])).toBeUndefined();
  });
});
