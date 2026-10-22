import { describe, expect, it } from "vitest";

import { bookingRequest } from "./booking-request";

const base = { clientId: "6f1c1f5e-77a1-4f6e-9d3b-2f1f0c0a1b11", serviceId: "3445da51-7724-48cf-8569-2556c4f434f9", zoneId: null, startsAt: "2026-10-23T16:30:00.000Z" };

describe("the booking request", () => {
  it("accepts a shop without dependants: none given, or an empty list (#169)", () => {
    expect(bookingRequest.safeParse(base).success).toBe(true);
    expect(bookingRequest.safeParse({ ...base, dependantIds: [] }).success).toBe(true);
    expect(bookingRequest.parse(base).dependantIds).toEqual([]);
  });
  it("still takes the dependants of a pet shop, as uuids, at most 50", () => {
    const dog = "7a1c1f5e-77a1-4f6e-9d3b-2f1f0c0a1b22";
    expect(bookingRequest.parse({ ...base, dependantIds: [dog] }).dependantIds).toEqual([dog]);
    expect(bookingRequest.safeParse({ ...base, dependantIds: ["not-a-uuid"] }).success).toBe(false);
    expect(bookingRequest.safeParse({ ...base, dependantIds: Array.from({ length: 51 }, () => dog) }).success).toBe(false);
  });
});
