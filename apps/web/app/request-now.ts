import { readEnv } from "@/lib/env";

import { systemClock } from "./system-clock";

/**
 * The instant a page is drawn at. The wall clock, except in a dev deployment that sets `APP_FIXED_NOW` (the visual and e2e runs): then
 * that instant, so « Open now », the free times and the day's team do not follow the hour of the run. A `prod` deployment ignores it.
 */
export function requestNow(source: Record<string, string | undefined> = process.env): Date {
  const settings = readEnv(source);
  if (settings.APP_ENVIRONMENT === "dev" && settings.APP_FIXED_NOW) return new Date(settings.APP_FIXED_NOW);
  return systemClock.now();
}
