import { describe, expect, it } from "vitest";

import { booksIsEmpty, booksView, periodChoices, periodFor } from "./books";

const TODAY = "2026-10-21";

describe("the period of a return", () => {
  it("offers the last four quarters, the latest completed one first", () => {
    expect(periodChoices(TODAY).map((p) => p.id)).toEqual(["2026-Q3", "2026-Q2", "2026-Q1", "2025-Q4"]);
  });

  it("defaults to the last completed quarter, and reads a quarter or a month from the address", () => {
    expect(periodFor(undefined, TODAY)).toMatchObject({ id: "2026-Q3", start: "2026-07-01", end: "2026-09-30" });
    expect(periodFor("2026-Q1", TODAY)).toMatchObject({ start: "2026-01-01", end: "2026-03-31" });
    expect(periodFor("2025-Q4", TODAY)).toMatchObject({ start: "2025-10-01", end: "2025-12-31" });
    expect(periodFor("2026-02", TODAY)).toMatchObject({ id: "2026-02", start: "2026-02-01", end: "2026-02-28" });
  });

  it("falls back to the default on anything else (never a query built from the address)", () => {
    for (const bad of ["", "2026-Q5", "2026-13", "x'; drop table", "2026-Q3 ", "99999-Q1"]) expect(periodFor(bad, TODAY).id).toBe("2026-Q3");
  });

  it("crosses the year: January's last completed quarter is the previous Q4", () => {
    expect(periodChoices("2027-01-05").map((p) => p.id)[0]).toBe("2026-Q4");
  });
});

describe("the books view", () => {
  const prepared = {
    periodStart: "2026-07-01",
    periodEnd: "2026-09-30",
    gstNetCents: 1_000,
    qstNetCents: -250,
    preparedOnly: true as const,
    lines: [
      { line: "101", amountCents: 20_000, sources: [] },
      { line: "103", amountCents: 1_500, sources: [{ kind: "invoice" as const, id: "i1", label: "F-00001", amountCents: 1_500 }] },
      { line: "106", amountCents: 500, sources: [{ kind: "expense" as const, id: "e1", label: "Fizz", amountCents: 500 }] },
      { line: "109", amountCents: 1_000, sources: [] },
      { line: "203", amountCents: 750, sources: [] },
      { line: "206", amountCents: 1_000, sources: [] },
      { line: "209", amountCents: -250, sources: [] },
    ],
  };

  it("says to remit or to claim from the sign of each net, and always that it is prepared, not filed", () => {
    const v = booksView(prepared);
    expect(v.gst).toEqual({ netCents: 1_000, outcome: "remit" });
    expect(v.qst).toEqual({ netCents: 250, outcome: "claim" });
    expect(v.preparedOnly).toBe(true);
    expect(booksView({ ...prepared, gstNetCents: 0 }).gst.outcome).toBe("zero");
  });

  it("keeps every FPZ-500 line, with the working papers of the figures that have sources", () => {
    const v = booksView(prepared);
    expect(v.lines.map((l) => l.line)).toEqual(["101", "103", "106", "109", "203", "206", "209"]);
    expect(v.lines.find((l) => l.line === "103")!.sources).toHaveLength(1);
    expect(v.lines.find((l) => l.line === "109")!.computed).toBe(true);
    expect(v.lines.find((l) => l.line === "103")!.computed).toBe(false);
  });
});

describe("an empty period", () => {
  it("is empty when no line has an amount or a document, and not when one has", () => {
    expect(booksIsEmpty({ lines: [{ line: "101", amountCents: 0, sources: [] }] })).toBe(true);
    expect(booksIsEmpty({ lines: [{ line: "101", amountCents: 100, sources: [] }] })).toBe(false);
    expect(booksIsEmpty({ lines: [{ line: "103", amountCents: 0, sources: [{ kind: "invoice", id: "i", label: "F", amountCents: 0 }] }] })).toBe(false);
  });
});
