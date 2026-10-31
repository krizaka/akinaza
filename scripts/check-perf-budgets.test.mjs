import { describe, expect, it } from "vitest";

import { blocksRun, judge, lowered, median, ratchet, screensOf, summarise } from "./check-perf-budgets.mjs";

const ok = { lcpMs: 1800, cls: 0, screens: 4.2, heroLcp: true, jsBytes: 100 };

describe("perf budgets", () => {
  it("takes the median and counts phone screens", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 10])).toBe(2.5);
    expect(screensOf(3376)).toBe(4);
  });

  it("summarises samples by the median and keeps the spread", () => {
    const s = summarise([
      { lcpMs: 1000, cls: 0, screens: 4, heroLcp: true, jsBytes: 10 },
      { lcpMs: 3000, cls: 0, screens: 4, heroLcp: true, jsBytes: 10 },
      { lcpMs: 1200, cls: 0.01, screens: 4, heroLcp: false, jsBytes: 12 },
    ]);
    expect(s).toMatchObject({ lcpMs: 1200, cls: 0, heroLcp: false, jsBytes: 10, lcpSpreadMs: 2000 });
  });

  it("passes inside every budget", () => {
    expect(judge("/r", ok)).toEqual([]);
    expect(judge("/r", { ...ok, lcpMs: 2500, screens: 5 })).toEqual([]);
  });

  it("fails each absolute budget on its own", () => {
    expect(judge("/r", { ...ok, lcpMs: 2501 })).toEqual(["/r: LCP 2501 ms > 2500 ms"]);
    expect(judge("/r", { ...ok, heroLcp: false })).toEqual(["/r: the LCP element is not the hero"]);
    expect(judge("/r", { ...ok, cls: 0.001 })).toEqual(["/r: CLS 0.001 > 0"]);
    expect(judge("/r", { ...ok, screens: 5.01 })).toEqual(["/r: 5.01 phone screens > 5"]);
  });

  it("ratchet: fails on an increase, passes on equal or lower, reports new routes", () => {
    expect(ratchet({ a: 100 }, { a: 101 })).toMatchObject({ ok: false, increased: [{ route: "a", from: 100, to: 101 }] });
    expect(ratchet({ a: 100 }, { a: 100 }).ok).toBe(true);
    expect(ratchet({ a: 100 }, { a: 90 })).toMatchObject({ ok: true, decreased: ["a"] });
    expect(ratchet({}, { b: 5 })).toMatchObject({ ok: true, added: ["b"] });
  });

  it("lowered never raises an entry and records new routes", () => {
    expect(lowered({ a: 100, b: 50 }, { a: 120, b: 40, c: 7 })).toEqual({ a: 100, b: 40, c: 7 });
  });

  it("a layout shift always fails the run (it is deterministic, spread 0), while LCP and the screens stay reported when the run is non-blocking (akinaza#460)", () => {
    const problems = ["/en/s/a: CLS 0.2 > 0", "/en/s/a: LCP 3000 ms > 2500 ms", "/en/s/a: 6 phone screens > 5"];
    expect(blocksRun(problems, "0")).toBe(true); // the CLS one
    expect(blocksRun(problems.slice(1), "0")).toBe(false);
    expect(blocksRun(problems.slice(1), undefined)).toBe(true);
    expect(blocksRun([], undefined)).toBe(false);
  });
});
