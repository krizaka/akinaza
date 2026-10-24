import { describe, expect, it } from "vitest";

import { staffDayFromEnv } from "../scripts/seed-staff-day.mjs";

describe("the staff day script", () => {
  it("defaults to Camille of the demo salon at 16:00, with a fictional client", () => {
    expect(staffDayFromEnv({})).toMatchObject({ email: "camille.staff@akinaza.test", shopSlug: "cedre-ciseaux", hour: 16, client: { email: "lea.fictive@akinaza.test" } });
  });

  it("takes the person, the shop and the hour from the environment", () => {
    expect(staffDayFromEnv({ QA_STAFF_EMAIL: " Marc@Akinaza.test ", QA_STAFF_SHOP: "autre", QA_STAFF_HOUR: "9" })).toMatchObject({ email: "marc@akinaza.test", shopSlug: "autre", hour: 9 });
  });

  it.each([["QA_STAFF_EMAIL", "pas une adresse"], ["QA_STAFF_HOUR", "25"], ["QA_STAFF_HOUR", "midi"]])("refuses %s = %s", (key, value) => {
    expect(() => staffDayFromEnv({ [key]: value })).toThrow();
  });
});
