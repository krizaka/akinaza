import { parseProtectedTerms } from "@akinaza/core";
import type { SlugPolicy } from "@akinaza/db";

import { appSettings } from "./settings";

/** What a save of a shop page knows about addresses: the protected terms the administrator keeps (ADR-005 slice 4, #537). A line that cannot be kept (an unsafe pattern stored before the check) is skipped, never compiled. */
export async function slugPolicy(): Promise<SlugPolicy> {
  return { terms: parseProtectedTerms(await appSettings().get("slugs.protectedTerms")).terms };
}
