/**
 * The calendar sources of a shop (ADR-004, akinaza#282): a port, one adapter per provider or format. A source is **read-only**:
 * it tells when the owner is busy, nothing else (no title, no attendee), and Akinaza never writes to it.
 */
export const CALENDAR_KINDS = ["ics", "google", "outlook", "caldav"] as const;
export type CalendarKind = (typeof CALENDAR_KINDS)[number];

/** A stretch of time the owner is busy elsewhere. */
export interface BusyInterval {
  startsAt: Date;
  endsAt: Date;
}

/** The window a sync reads: busy times outside it are of no use to the slots. */
export interface BusyRange {
  from: Date;
  to: Date;
}

/** What the provider told us last time, sent back so an unchanged calendar costs one light answer (`ETag`, `If-Modified-Since`, a sync token). */
export interface Validators {
  etag: string | null;
  lastModified: string | null;
}

export const NO_VALIDATORS: Validators = { etag: null, lastModified: null };

export type BusyResult = { changed: false } | { changed: true; busy: BusyInterval[]; validators: Validators };

/** Why a source could not be read; `retryable` tells the sync to try again later (backoff) rather than ask the owner to reconnect. */
export class CalendarSourceError extends Error {
  constructor(
    readonly code: "AK_CAL_UNREACHABLE" | "AK_CAL_REFUSED" | "AK_CAL_INVALID" | "AK_CAL_TOO_LARGE" | "AK_CAL_UNAUTHORIZED" | "AK_CAL_RATE_LIMITED",
    readonly retryable: boolean,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "CalendarSourceError";
  }
}

/** The port every source implements. */
export interface CalendarSource {
  readonly kind: CalendarKind;
  /** The owner's busy times in the range; `{ changed: false }` when the validators say nothing moved. */
  busy(range: BusyRange, validators: Validators): Promise<BusyResult>;
}

export interface CalendarRef {
  id: string;
  name: string;
}

export interface Grant {
  /** What is kept (sealed) to read again: a refresh token, or a CalDAV credential. Never returned by any route. */
  secret: string;
  calendars: CalendarRef[];
}

/** A source that needs the owner's consent at the provider (OAuth) before it can be read. */
export interface ConnectableSource extends CalendarSource {
  /** `codeChallenge` is the S256 challenge of a PKCE verifier kept by the caller (RFC 7636): a stolen code is of no use without it. */
  authorizeUrl(input: { state: string; redirectUri: string; codeChallenge: string; loginHint?: string }): string;
  exchange(input: { code: string; redirectUri: string; codeVerifier: string }): Promise<Grant>;
  listCalendars(): Promise<CalendarRef[]>;
  /** Tells the provider to forget the grant; the connection and its busy times are deleted by the caller whatever happens. */
  revoke(): Promise<void>;
}

/** Sorted, merged: overlapping or touching busy intervals become one. */
export function mergeBusy(intervals: readonly BusyInterval[]): BusyInterval[] {
  const sorted = intervals.filter((i) => i.endsAt.getTime() > i.startsAt.getTime()).sort((a, b) => (a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : 0));
  const out: BusyInterval[] = [];
  for (const next of sorted) {
    const last = out.at(-1);
    if (last && next.startsAt.getTime() <= last.endsAt.getTime()) {
      if (next.endsAt.getTime() > last.endsAt.getTime()) last.endsAt = next.endsAt;
    } else out.push({ startsAt: next.startsAt, endsAt: next.endsAt });
  }
  return out;
}

/** True when `[startsAt, endsAt)` shares time with any busy interval (touching ends do not overlap). */
export function overlapsBusy(startsAt: Date, endsAt: Date, busy: readonly BusyInterval[]): boolean {
  return busy.some((b) => startsAt.getTime() < b.endsAt.getTime() && b.startsAt.getTime() < endsAt.getTime());
}

// @fixed: how far a failing source backs off at most, in minutes (a day): after that it is tried once a day until the owner fixes or removes it
const MAX_BACKOFF_MINUTES = 1_440;

/** Minutes until the next try: the administrator's interval, doubled at each consecutive failure, never beyond a day. */
export function nextSyncDelayMinutes(intervalMinutes: number, failures: number): number {
  return Math.min(intervalMinutes * 2 ** Math.min(Math.max(failures, 0), 10), Math.max(MAX_BACKOFF_MINUTES, intervalMinutes));
}
