import { z } from "zod";

import { addLocalDays } from "./service-shop";

/**
 * Payment terms of an invoice (krizaka/akinaza#113). For a supply of $500 or more a buyer needs the terms to claim its input
 * tax credits (DORS/91-45, art. 3): a due date, and the terms it comes from (« net 30 »). The days are the shop's rule
 * (`shop_rules.payment_terms_days`, 30 by default), chosen again on an invoice if it differs; 0 is « due on receipt ».
 */
export const termsDaysSchema = z.number().int().min(0).max(365);

/** The terms an invoice's picker offers besides the shop's own default; the bounds are the database CHECK. */
// @fixed: the choices of a picker (a closed set offered to the user); any value 0–365 stays valid at the door.
export const PAYMENT_TERMS_CHOICES = [0, 15, 30, 45, 60] as const;

/** The day an invoice issued on `issuedOn` (`YYYY-MM-DD`) falls due with `termsDays` of terms. Calendar days, no clock. */
export function dueOn(issuedOn: string, termsDays: number): string {
  return addLocalDays(issuedOn, termsDaysSchema.parse(termsDays));
}
