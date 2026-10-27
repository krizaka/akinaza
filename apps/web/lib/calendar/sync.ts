import { addLocalDays, type BusyRange, CalendarSourceError, localDay, localInstant, NO_VALIDATORS } from "@akinaza/core";
import { claimDueConnections, type DueConnection, openField, recordSyncFailure, recordSyncOk } from "@akinaza/db";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/settings";

import { sourceFor,type SourceMaker } from "./registry";

// @fixed: connections read per tick, and the lease that keeps another instance (or the next tick) from reading the same one meanwhile
const BATCH = 20;
const LEASE_MINUTES = 5;

export interface SyncSettings {
  intervalMinutes: number;
  windowDays: number;
}

export async function syncSettings(): Promise<SyncSettings> {
  const s = appSettings();
  const [intervalMinutes, windowDays] = await Promise.all([s.get("calendarSync.intervalMinutes"), s.get("calendarSync.windowDays")]);
  return { intervalMinutes, windowDays };
}

/** The window the slots can use: from the start of yesterday (a visit under way) to the booking horizon the administrator bounds, on the shop's days. */
export function windowOf(now: Date, windowDays: number, timezone: string): BusyRange {
  const today = localDay(now, timezone);
  return { from: localInstant(addLocalDays(today, -1), 0, timezone), to: localInstant(addLocalDays(today, windowDays + 1), 0, timezone) };
}

/** Reads one claimed connection and records the outcome. Never throws: a failure is the connection's state, with a backoff. */
export async function syncConnection(c: DueConnection, now: Date, settings: SyncSettings, key: Buffer, make: SourceMaker = sourceFor): Promise<"ok" | "unchanged" | "error"> {
  try {
    const source = make(c.kind, openField(c.secretEnc, key, c.id), c.timezone);
    if (!source) throw new CalendarSourceError("AK_CAL_REFUSED", false, "this kind of calendar is switched off");
    const result = await source.busy(windowOf(now, settings.windowDays, c.timezone), c.stale ? NO_VALIDATORS : c.validators);
    await recordSyncOk(db(), c, result.changed ? { busy: result.busy, validators: result.validators } : null, now, settings.intervalMinutes);
    return result.changed ? "ok" : "unchanged";
  } catch (error) {
    const code = error instanceof CalendarSourceError ? error.code : "AK_CAL_UNREACHABLE";
    await recordSyncFailure(db(), c, code, now, settings.intervalMinutes);
    // One audit line when it starts failing, not at every retry.
    if (c.failures === 0) await audit({ action: "shop.calendar_sync_failed", actorId: null, actorLabel: "calendar-sync", targetId: c.shopId, detail: { connectionId: c.id, kind: c.kind, code } });
    return "error";
  }
}

/** The tick (`instrumentation.ts`): every connection whose time has come, a few at a time. Off when the administrator has switched the feature off. */
export async function syncDueCalendars(now: Date, key: Buffer, make: SourceMaker = sourceFor): Promise<number> {
  if (!(await appSettings().get("features.calendarSync"))) return 0;
  const settings = await syncSettings();
  const due = await claimDueConnections(db(), now, BATCH, LEASE_MINUTES);
  for (const c of due) await syncConnection(c, now, settings, key, make);
  return due.length;
}
