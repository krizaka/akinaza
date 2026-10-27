import { describe, expect, it } from "vitest";

import { csvCell, csvLine, dollars, EXPORT_FILES, formatOf, isExportFile, kindOf, localDateTime } from "./data-export";
import { getDictionary } from "./i18n";

describe("the data exports' text (#420)", () => {
  it("quotes what needs quotes and doubles the quotes", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(csvCell(null)).toBe("");
    expect(csvLine(["a", null, "b c"])).toBe("a,,b c\r\n");
  });

  it("turns a cell a spreadsheet would run as a formula into text", () => {
    for (const evil of ["=1+1", "+cmd", "-2+3", "@SUM(A1)", "\tx", "\rx"]) expect(csvCell(evil).replace(/^"/, "")).toMatch(/^'/);
    expect(csvCell("Rex-2")).toBe("Rex-2");
  });

  it("writes cents as dollars and an instant in the shop's clock", () => {
    expect([dollars(0), dollars(3800), dollars(5174), dollars(-225)]).toEqual(["0.00", "38.00", "51.74", "-2.25"]);
    expect(localDateTime(new Date("2026-11-21T03:30:00Z"), "America/Toronto")).toBe("2026-11-20 22:30");
  });

  it("offers exactly the four files, and no other name", () => {
    expect(EXPORT_FILES).toEqual(["appointments.csv", "appointments.ics", "clients.csv", "invoices.csv"]);
    expect(EXPORT_FILES.map((f) => [kindOf(f), formatOf(f)])).toEqual([["appointments", "csv"], ["appointments", "ics"], ["clients", "csv"], ["invoices", "csv"]]);
    for (const bad of ["accounts.csv", "clients.json", "../clients.csv", "clients"]) expect(isExportFile(bad)).toBe(false);
  });

  it("has every column and word in both languages", () => {
    const en = getDictionary("en").console.exports;
    const fr = getDictionary("fr").console.exports;
    expect(Object.keys(fr.columns.invoices)).toEqual(Object.keys(en.columns.invoices));
    expect(Object.keys(fr.status)).toEqual(["booked", "done", "cancelled", "noShow"]);
    expect(fr.columns.clients.name).not.toBe(en.columns.clients.name);
  });
});
