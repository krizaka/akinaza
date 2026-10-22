import { describe, expect, it } from "vitest";

import { buildIcs } from "./ics";

const base = { uid: "b1", start: new Date("2026-10-27T17:00:00Z"), end: new Date("2026-10-27T18:00:00Z"), summary: "Coupe — Salon Cèdre & Ciseaux", now: new Date("2026-10-22T12:00:00Z") };

describe("add to calendar", () => {
  it("is a valid VCALENDAR with the time in UTC", () => {
    const ics = buildIcs(base);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261027T170000Z");
    expect(ics).toContain("DTEND:20261027T180000Z");
    expect(ics).toContain("DTSTAMP:20261022T120000Z");
    expect(ics).toContain("UID:b1@akinaza.com");
  });
  it("escapes commas, semicolons and line breaks, and omits what is not given", () => {
    const ics = buildIcs({ ...base, summary: "A, B; C", location: "4100 rue Notre-Dame O., Montréal", description: "ligne 1\nligne 2" });
    expect(ics).toContain("SUMMARY:A\\, B\\; C");
    expect(ics).toContain("LOCATION:4100 rue Notre-Dame O.\\, Montréal");
    expect(ics).toContain("DESCRIPTION:ligne 1\\nligne 2");
    expect(buildIcs(base)).not.toContain("LOCATION");
  });
  it("folds long lines before 75 octets, never inside a character", () => {
    const ics = buildIcs({ ...base, description: "é".repeat(120) });
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics.replace(/\r\n /g, "")).toContain("é".repeat(120));
  });
});
