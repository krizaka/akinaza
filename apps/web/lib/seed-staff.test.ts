import { describe, expect, it } from "vitest";

// A plain ES module script (scripts/seed-staff.mjs), tested here like the other QA scripts.
import { staffFromEnv } from "../scripts/seed-staff.mjs";

describe("the staff seeding script", () => {
  const env = { QA_STAFF_EMAIL: " Camille.Staff@Akinaza.TEST ", QA_STAFF_PASSWORD: "x".repeat(16) };
  it("defaults to staff of the demo salon, with the address in lower case", () => {
    expect(staffFromEnv(env)).toEqual({ email: "camille.staff@akinaza.test", password: "x".repeat(16), role: "staff", shopSlug: "cedre-ciseaux" });
  });
  it("takes another shop or role, and refuses what cannot work", () => {
    expect(staffFromEnv({ ...env, QA_STAFF_ROLE: "manager", QA_STAFF_SHOP: "x" })).toMatchObject({ role: "manager", shopSlug: "x" });
    expect(() => staffFromEnv({ ...env, QA_STAFF_ROLE: "admin" })).toThrow(/one of owner, manager, staff/);
    expect(() => staffFromEnv({ ...env, QA_STAFF_PASSWORD: "short" })).toThrow(/12 characters/);
    expect(() => staffFromEnv({ ...env, QA_STAFF_EMAIL: "nope" })).toThrow(/invalid/);
  });
});
