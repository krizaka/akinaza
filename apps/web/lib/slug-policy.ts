import { parseProtectedTerms } from "@akinaza/core";
import type { SlugPolicy } from "@akinaza/db";

import { appSettings } from "./settings";

/** What a save of a shop page knows about addresses: the protected terms and the pace of address changes the administrator keeps (ADR-005 slice 4, #537). A line that cannot be kept (an unsafe pattern stored before the check) is skipped, never compiled. */
export async function slugPolicy(): Promise<SlugPolicy> {
  const settings = appSettings();
  const [terms, max, days] = await Promise.all([settings.get("slugs.protectedTerms"), settings.get("limits.slugChanges"), settings.get("limits.slugChangeWindowDays")]);
  return { terms: parseProtectedTerms(terms).terms, slugChanges: { max, days } };
}
