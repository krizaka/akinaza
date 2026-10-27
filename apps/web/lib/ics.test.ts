import { describe, expect, it } from "vitest";

import { buildFeedIcs, buildIcs } from "./ics";

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

describe("the private feed (ADR-004)", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  const entries = [
    { appointmentId: "a1", start: new Date("2026-10-27T14:00:00Z"), end: new Date("2026-10-27T14:45:00Z"), service: "Coupe, brushing", firstNames: ["Camille", "Luc"] },
    { appointmentId: "a2", start: new Date("2026-10-28T14:00:00Z"), end: new Date("2026-10-28T15:00:00Z"), service: "Coloration", firstNames: [] },
  ];

  it("writes one event per appointment, the service and the first names, and nothing else", () => {
    const ics = buildFeedIcs({ name: "Akinaza · Salon Laurier", entries, now });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("UID:a1@akinaza.com");
    expect(ics).toContain("DTSTART:20261027T140000Z");
    expect(ics).toContain("SUMMARY:Coupe\\, brushing · Camille\\, Luc");
    expect(ics).toContain("SUMMARY:Coloration\r\n");
    for (const forbidden of ["LOCATION", "DESCRIPTION", "ATTENDEE", "ORGANIZER", "TEL", "mailto"]) expect(ics).not.toContain(forbidden);
  });

  it("is an empty calendar, not an error, when nothing is booked", () => {
    expect(buildFeedIcs({ name: "x", entries: [], now })).not.toContain("BEGIN:VEVENT");
  });
});
