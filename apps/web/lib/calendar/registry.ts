import type { CalendarKind, CalendarSource, ConnectableSource } from "@akinaza/core";

import { caldavSource } from "./caldav-source";
import { googleSource } from "./google-source";
import { icsUrlSource } from "./ics-url-source";
import type { OAuthKind } from "./oauth-state";
import { outlookSource } from "./outlook-source";

/** The OAuth client of Akinaza at a provider (the owner's consent is asked for it); absent until the administrator has created it. */
export interface OAuthApp {
  clientId: string;
  clientSecret: string;
}
export type OAuthApps = Partial<Record<OAuthKind, OAuthApp>>;
export type SourceMaker = (kind: CalendarKind, secret: string, timezone: string) => CalendarSource | null;

/** What a CalDAV connection keeps sealed: the collection's address and the credential (an app-specific password for iCloud). */
export interface CaldavSecret {
  url: string;
  username: string;
  password: string;
}

export const sealedCaldav = (secret: CaldavSecret): string => JSON.stringify(secret);

function caldavOf(secret: string): CaldavSecret | null {
  try {
    const v = JSON.parse(secret) as Partial<CaldavSecret>;
    return typeof v.url === "string" && typeof v.username === "string" && typeof v.password === "string" ? { url: v.url, username: v.username, password: v.password } : null;
  } catch {
    return null;
  }
}

/** The consent side of a provider, with or without a grant yet; `null` when its OAuth client is not configured. */
export function connectable(kind: OAuthKind, apps: OAuthApps, refreshToken?: string, fetchImpl?: typeof fetch): ConnectableSource | null {
  const app = apps[kind];
  if (!app) return null;
  const options = { ...app, ...(refreshToken ? { refreshToken } : {}), ...(fetchImpl ? { fetch: fetchImpl } : {}) };
  return kind === "google" ? googleSource(options) : outlookSource(options);
}

/** The source of an ICS address (no provider, no flag beyond the feature's). */
export function sourceFor(kind: CalendarKind, secret: string, timezone: string): CalendarSource | null {
  return kind === "ics" ? icsUrlSource({ url: secret, timezone }) : null;
}

/**
 * The sync's source maker: a provider is read only while the administrator's flag for it is on and, for OAuth ones, its client exists
 * (a switched-off kind makes its connections fail with a word, and they are read again the day it is switched on).
 */
export function sourceFactory(apps: OAuthApps, enabled: Partial<Record<CalendarKind, boolean>>, fetchImpl?: typeof fetch): SourceMaker {
  return (kind, secret, timezone) => {
    if (kind === "ics") return sourceFor(kind, secret, timezone);
    if (!enabled[kind]) return null;
    if (kind === "caldav") {
      const c = caldavOf(secret);
      return c ? caldavSource({ ...c, timezone, ...(fetchImpl ? { fetch: fetchImpl } : {}) }) : null;
    }
    return connectable(kind, apps, secret, fetchImpl);
  };
}
