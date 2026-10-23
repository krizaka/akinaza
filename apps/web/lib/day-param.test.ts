import { describe, expect, it } from "vitest";

import { calendarQuery, dayParam, queryOf } from "./day-param";

describe("the day an app asks for", () => {
  it.each(["2026-10-20", "2028-02-29"])("accepts %s", (day) => expect(dayParam.safeParse(day).success).toBe(true));
  it.each(["2026-13-01", "2026-02-30", "20-10-2026", "2026-10-20T10:00", "", "tomorrow"])("refuses %j", (day) => expect(dayParam.safeParse(day).success).toBe(false));

  it("reads a calendar range from the query string", () => {
    const query = queryOf(new Request("https://www.akinaza.com/api/walker/calendar?from=2026-10-01&to=2026-10-31"));
    expect(calendarQuery.parse(query)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(calendarQuery.safeParse(queryOf(new Request("https://x.test/?from=2026-10-01"))).success).toBe(false);
  });
});
