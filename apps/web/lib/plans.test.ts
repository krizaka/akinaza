import { describe, expect, it } from "vitest";

import { isPlanId, planRefusal, trialDaysFor, trialDaysOf, trialMonthsOf,TrialRefused } from "./plans";

const starter = { availability: "public", amountCents: 2900, limits: { trialDays: 90 } } as const;

describe("the free trial (the entry's trialDays, once per account, test mode only)", () => {
  it("gives the entry's free days to an account that never subscribed, and none to one that did", () => {
    expect(trialDaysFor(starter, { eligible: true, liveMode: false })).toBe(90);
    expect(trialDaysFor(starter, { eligible: false, liveMode: false })).toBe(0);
    expect(trialDaysFor(starter, { eligible: false, liveMode: true })).toBe(0);
  });

  it("an entry without a trial gives none, on any key", () => {
    expect(trialDaysFor({ limits: {} }, { eligible: true, liveMode: true })).toBe(0);
    expect(trialDaysOf({ limits: {} })).toBe(0);
  });

  it("refuses a trial on a live processor key instead of giving it silently", () => {
    expect(() => trialDaysFor(starter, { eligible: true, liveMode: true })).toThrow(TrialRefused);
    expect(new TrialRefused().code).toBe("TRIAL_TEST_MODE_ONLY");
  });

  it("words the trial in whole months only (90 days = 3 months; 45 days is not announced as months)", () => {
    expect(trialMonthsOf(starter)).toBe(3);
    expect(trialMonthsOf({ limits: { trialDays: 45 } })).toBeNull();
    expect(trialMonthsOf({ limits: {} })).toBeNull();
  });
});

describe("who may buy which plan", () => {
  it("Association needs an approved proof; until then it is refused (the account stays on Starter)", () => {
    const association = { availability: "public", amountCents: 100 } as const;
    expect(planRefusal("association", association, { associationApproved: false })).toBe("ASSOCIATION_NOT_APPROVED");
    expect(planRefusal("association", association, { associationApproved: true })).toBeNull();
    expect(planRefusal("starter", starter, { associationApproved: false })).toBeNull();
  });

  it("an internal or in-preparation entry is not on sale; the founder entry only while founder-limited", () => {
    expect(planRefusal("starter", { availability: "internal", amountCents: 2900 }, { associationApproved: false })).toBe("PLAN_NOT_ON_SALE");
    expect(planRefusal("scale", { availability: "preparing", amountCents: null }, { associationApproved: false })).toBe("PLAN_NOT_ON_SALE");
    expect(planRefusal("founder", { availability: "founder-limited", amountCents: 3900 }, { associationApproved: false })).toBeNull();
    expect(planRefusal("starter", { availability: "founder-limited", amountCents: 3900 }, { associationApproved: false })).toBe("PLAN_NOT_ON_SALE");
  });

  it("knows its plan ids", () => {
    expect(["founder", "starter", "scale", "association"].every(isPlanId)).toBe(true);
    expect(isPlanId("enterprise")).toBe(false);
  });
});
