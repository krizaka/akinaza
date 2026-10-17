import { describe, expect, it } from "vitest";

import { canCancel, dependantInputSchema, localDay, localInstant, openSlots, type SlotRequest, slugSchema, sniffImage, visitMinutes, weekdayOf } from "./service-shop";

const TZ = "America/Toronto";
const base: SlotRequest = {
  timezone: TZ,
  now: new Date("2026-10-19T12:00:00Z"), // Monday 08:00 in Montréal (EDT, UTC-4)
  fromDay: "2026-10-19",
  days: 2,
  windows: [{ weekday: 1, startsAt: "09:00", endsAt: "11:00" }, { weekday: 2, startsAt: "09:00", endsAt: "10:00" }],
  daysOff: [],
  serviceId: "walk-60",
  zoneId: "saint-henri",
  durationMinutes: 60,
  stepMinutes: 30,
  capacity: 1,
  minNoticeMinutes: 60,
  visits: [],
};
const starts = (r: ReturnType<typeof openSlots>) => r.map((s) => s.startsAt.toISOString());

describe("local time in the shop's zone", () => {
  it("turns a wall-clock time into the right instant, daylight saving included", () => {
    expect(localInstant("2026-10-19", 9 * 60, TZ).toISOString()).toBe("2026-10-19T13:00:00.000Z");
    expect(localInstant("2026-12-14", 9 * 60, TZ).toISOString()).toBe("2026-12-14T14:00:00.000Z");
  });
  it("names the local day of an instant, and its weekday", () => {
    expect(localDay(new Date("2026-10-20T02:30:00Z"), TZ)).toBe("2026-10-19");
    expect(weekdayOf("2026-10-19")).toBe(1);
  });
});

describe("openSlots", () => {
  it("offers the start times that fit the windows, on the step", () => {
    expect(starts(openSlots(base))).toEqual(["2026-10-19T13:00:00.000Z", "2026-10-19T13:30:00.000Z", "2026-10-19T14:00:00.000Z", "2026-10-20T13:00:00.000Z"]);
  });
  it("skips days off and what starts before now plus the notice", () => {
    const r = openSlots({ ...base, now: new Date("2026-10-19T13:10:00Z"), minNoticeMinutes: 30 });
    expect(starts(r)).toEqual(["2026-10-19T14:00:00.000Z", "2026-10-20T13:00:00.000Z"]);
    expect(starts(openSlots({ ...base, daysOff: ["2026-10-19"] }))).toEqual(["2026-10-20T13:00:00.000Z"]);
  });
  it("does not offer a start that would overlap a visit already taken", () => {
    const taken = { startsAt: new Date("2026-10-19T13:30:00Z"), endsAt: new Date("2026-10-19T14:30:00Z"), serviceId: "other", zoneId: null, seatsTaken: 1 };
    expect(starts(openSlots({ ...base, visits: [taken] }))).toEqual(["2026-10-20T13:00:00.000Z"]);
  });
  it("lets a client join a group visit with seats left, and stops offering it when it is full", () => {
    const group = { ...base, serviceId: "group", capacity: 4 };
    const visit = { startsAt: new Date("2026-10-19T13:00:00Z"), endsAt: new Date("2026-10-19T14:00:00Z"), serviceId: "group", zoneId: "saint-henri", seatsTaken: 3 };
    const joined = openSlots({ ...group, visits: [visit] });
    expect(joined[0]).toMatchObject({ joins: true, seatsLeft: 1, capacity: 4 });
    expect(starts(joined)).not.toContain("2026-10-19T13:30:00.000Z"); // overlaps the group walk
    const full = openSlots({ ...group, visits: [{ ...visit, seatsTaken: 4 }] });
    expect(starts(full)).not.toContain("2026-10-19T13:00:00.000Z");
  });
  it("does not let a group visit in another zone be joined", () => {
    const visit = { startsAt: new Date("2026-10-19T13:00:00Z"), endsAt: new Date("2026-10-19T14:00:00Z"), serviceId: "group", zoneId: "griffintown", seatsTaken: 1 };
    expect(starts(openSlots({ ...base, serviceId: "group", capacity: 4, visits: [visit] }))).not.toContain("2026-10-19T13:00:00.000Z");
  });
});

describe("the rest of the model", () => {
  it("cancels until the shop's window before the visit", () => {
    const visit = new Date("2026-10-20T13:00:00Z");
    expect(canCancel(visit, new Date("2026-10-19T12:59:00Z"), 24)).toBe(true);
    expect(canCancel(visit, new Date("2026-10-19T13:01:00Z"), 24)).toBe(false);
  });
  it("counts a walk in whole minutes, at least one", () => {
    expect(visitMinutes(new Date("2026-10-19T13:00:00Z"), new Date("2026-10-19T13:45:20Z"))).toBe(45);
    expect(visitMinutes(new Date("2026-10-19T13:00:00Z"), new Date("2026-10-19T13:00:05Z"))).toBe(1);
  });
  it("recognises a photo by its bytes, never by its declared type", () => {
    expect(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("jpeg");
    expect(sniffImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe("png");
    expect(sniffImage(new TextEncoder().encode("RIFF1234WEBPVP8 "))).toBe("webp");
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
  it("accepts a shop address of words and hyphens, and refuses the site's own", () => {
    expect(slugSchema.parse(" Pattes-Saint-Henri ")).toBe("pattes-saint-henri");
    for (const bad of ["ab", "-x-y", "a_b_c", "api", "sign-in", "x".repeat(41)]) expect(slugSchema.safeParse(bad).success).toBe(false);
  });
  it("validates a dog's profile at the door", () => {
    expect(dependantInputSchema.parse({ kind: "dog", name: "Rex", profile: { size: "large", vet: { name: "Clinique Saint-Henri", phone: "514-555-0100" } } }).profile.size).toBe("large");
    expect(dependantInputSchema.safeParse({ kind: "dog", name: "Rex", profile: { size: "huge" } }).success).toBe(false);
  });
});
