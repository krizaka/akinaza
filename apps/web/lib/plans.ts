import type { PriceEntry } from "@krizaka/settings";
import { AVAILABILITY } from "@krizaka/settings";

import { ASSOCIATION, FOUNDER, type PriceKey, SCALE, STARTER } from "./pricing";

/**
 * The plans a business chooses at the checkout (ADR-003 addendum 2026-10-30) and the rules that are Akinaza's, not the processor's:
 * which catalogue entry each plan is, who may have the Association plan (an administrator approved its proof), and the free trial
 * (the entry's `trialDays` limit, once per account, never on a live processor key). Vendor-free; the amounts come from the catalogue.
 */
export const PLAN_IDS = ["founder", "starter", "scale", "association"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const PLAN_KEY: Record<PlanId, PriceKey> = { founder: FOUNDER, starter: STARTER, scale: SCALE, association: ASSOCIATION };

export const isPlanId = (value: unknown): value is PlanId => PLAN_IDS.includes(value as PlanId);

// @fixed: the length of the month a trial is announced in (a unit conversion for the words « 3 months free »; the number of free days is the catalogue's)
const TRIAL_MONTH_DAYS = 30;

/** The free days an entry starts a subscription with (0 = none). */
export const trialDaysOf = (entry: Pick<PriceEntry, "limits">): number => entry.limits.trialDays ?? 0;

/** The free time as the pages say it, in whole months (« 3 months free »), or null when the entry has no trial or it is not a whole number of months. */
export function trialMonthsOf(entry: Pick<PriceEntry, "limits">): number | null {
  const days = trialDaysOf(entry);
  return days > 0 && days % TRIAL_MONTH_DAYS === 0 ? days / TRIAL_MONTH_DAYS : null;
}

export class TrialRefused extends Error {
  readonly code = "TRIAL_TEST_MODE_ONLY";
  constructor() {
    super("The free trial is only available in the processor's test mode");
  }
}

/**
 * The free days to give this checkout: the entry's, once per account (`eligible`: it never had a subscription). A trial on a live
 * processor key is refused (not given silently): the founder wants it proven in test mode first.
 */
export function trialDaysFor(entry: Pick<PriceEntry, "limits">, options: { eligible: boolean; liveMode: boolean }): number {
  const days = trialDaysOf(entry);
  if (days === 0 || !options.eligible) {return 0;}
  if (options.liveMode) {throw new TrialRefused();}
  return days;
}

/** Why a plan cannot be bought now, or null when it can: not on sale, or the Association plan without an approved proof. */
export function planRefusal(plan: PlanId, entry: Pick<PriceEntry, "availability" | "amountCents">, options: { associationApproved: boolean }): "PLAN_NOT_ON_SALE" | "ASSOCIATION_NOT_APPROVED" | null {
  const onSale = entry.amountCents !== null && (entry.availability === AVAILABILITY.public || (plan === "founder" && entry.availability === AVAILABILITY.founderLimited));
  if (!onSale) {return "PLAN_NOT_ON_SALE";}
  if (plan === "association" && !options.associationApproved) {return "ASSOCIATION_NOT_APPROVED";}
  return null;
}
