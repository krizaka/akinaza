import { CALENDAR_KINDS, type CalendarKind } from "@akinaza/core";
import { type ConnectionInfo, feedPeople, listConnections } from "@akinaza/db";

import { db } from "@/lib/db";
import { appSettings } from "@/lib/settings";

/** The words the owner agreed to when connecting: a version, so a later wording change is a new consent (Loi 25, ADR-004 section 10). */
export const CALENDAR_CONSENT_VERSION = "2026-10-26";

export interface CalendarOverview {
  enabled: boolean;
  /** The kinds the administrator has switched on. */
  kinds: CalendarKind[];
  /** Whose agenda a connection may block: the shop as a whole (owner, manager) or one team member. */
  people: { id: string; name: string }[];
  wholeShop: boolean;
  connections: (Omit<ConnectionInfo, "lastSuccessAt" | "consentedAt"> & { lastSuccessAt: string | null; consentedAt: string })[];
}

/** The calendars a member may manage and their state. Never an address or a grant: the secret never leaves the server. */
/** `configured`: the kinds that can work here (an OAuth provider needs its client, which only the edge knows). */
export async function calendarOverview(shopId: string, scope: { staffAccountId?: string }, configured: readonly CalendarKind[] = CALENDAR_KINDS): Promise<CalendarOverview> {
  const s = appSettings();
  if (!(await s.get("features.calendarSync"))) return { enabled: false, kinds: [], people: [], wholeShop: false, connections: [] };
  const enabled = await Promise.all(CALENDAR_KINDS.map((k) => s.get(`calendarSync.${k}.enabled` as const)));
  const [people, connections] = await Promise.all([feedPeople(db(), shopId, scope), listConnections(db(), shopId, scope)]);
  return {
    enabled: true,
    kinds: CALENDAR_KINDS.filter((k, i) => enabled[i] && configured.includes(k)),
    people,
    wholeShop: scope.staffAccountId === undefined,
    connections: connections.map((c) => ({ ...c, lastSuccessAt: c.lastSuccessAt?.toISOString() ?? null, consentedAt: c.consentedAt.toISOString() })),
  };
}
