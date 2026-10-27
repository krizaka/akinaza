import { CALENDAR_KINDS, type CalendarKind } from "@akinaza/core";

import { type OAuthApps, sourceFactory, type SourceMaker } from "@/lib/calendar/registry";
import { calendarOAuthApps } from "@/lib/env";
import { appSettings } from "@/lib/settings";

/** The OAuth clients of this deployment (the edge reads the environment; `lib/` never does). */
export const oauthApps = (): OAuthApps => calendarOAuthApps();

/** The administrator's flag of each kind of calendar, read now (it can change while the server runs). */
export async function enabledKinds(): Promise<Record<CalendarKind, boolean>> {
  const s = appSettings();
  const on = await Promise.all(CALENDAR_KINDS.map((k) => s.get(`calendarSync.${k}.enabled` as const)));
  return Object.fromEntries(CALENDAR_KINDS.map((k, i) => [k, on[i]])) as Record<CalendarKind, boolean>;
}

/** What the sync reads with: the providers whose flag is on and whose OAuth client exists. */
export async function calendarSourceMaker(): Promise<SourceMaker> {
  return sourceFactory(oauthApps(), await enabledKinds());
}

/** The kinds that can work on this deployment: the ones with no client to create, and the OAuth providers whose client is set. */
export const configuredKinds = (): CalendarKind[] => CALENDAR_KINDS.filter((k) => k !== "google" && k !== "outlook" ? true : oauthApps()[k] !== undefined);
