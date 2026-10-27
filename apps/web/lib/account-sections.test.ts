import { describe, expect, it } from "vitest";

import { accountRoleLine, accountSectionsFor } from "./account-sections";
import { getDictionary } from "./i18n";

describe("the account's sections by role (docs/ux/2026-10-full-review.md K6, Errata 1)", () => {
  it("gives the owner all five, the subscription included", () => {
    expect(accountSectionsFor("owner")).toEqual(["profile", "preferences", "security", "subscription", "data"]);
  });

  it.each(["manager", "staff"] as const)("gives a %s their own account without the shop's subscription", (role) => {
    expect(accountSectionsFor(role)).toEqual(["profile", "preferences", "security", "data"]);
  });

  it("keeps the subscription for a person who runs no shop yet", () => {
    expect(accountSectionsFor(null)).toContain("subscription");
  });
});

describe("the role line of the profile", () => {
  const words = (locale: "en" | "fr") => getDictionary(locale).console.account.profile;
  const shop = { name: "Pattes de Saint-Henri" };

  it("says the owner and the staff member apart, with the shop, in each language", () => {
    expect(accountRoleLine(words("fr"), { admin: false, member: { role: "owner", shop } })).toBe("Propriétaire chez Pattes de Saint-Henri");
    expect(accountRoleLine(words("fr"), { admin: false, member: { role: "staff", shop } })).toBe("Employé chez Pattes de Saint-Henri");
    expect(accountRoleLine(words("en"), { admin: false, member: { role: "staff", shop } })).toBe("Staff at Pattes de Saint-Henri");
  });

  it("names an administrator, and says nothing for a client: they hold no role (akinaza#440)", () => {
    expect(accountRoleLine(words("fr"), { admin: true, member: null })).toBe("Administrateur");
    expect(accountRoleLine(words("fr"), { admin: false, member: null })).toBeNull();
  });
});
