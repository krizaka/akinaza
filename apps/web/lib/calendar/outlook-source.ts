import { type BusyInterval, type BusyRange, type BusyResult, type CalendarRef, CalendarSourceError, type ConnectableSource, type Grant, mergeBusy } from "@akinaza/core";

import { jsonOf, postForm, str } from "./oauth-fetch";

/**
 * Microsoft 365 / Outlook.com through Microsoft Graph, read-only: `Calendars.ReadBasic` (the least privileged for `calendarView`) and
 * `offline_access` for the refresh token (ADR-004). Only start, end and the free/busy state are asked for: never a subject or an attendee.
 * Microsoft has no endpoint to revoke a refresh token: the owner removes the consent in their account; disconnecting here deletes our copy.
 */
export const OUTLOOK_SCOPE = "https://graph.microsoft.com/Calendars.ReadBasic offline_access";
const AUTHORITY = "https://login.microsoftonline.com/common/oauth2/v2.0";
const VIEW = "https://graph.microsoft.com/v1.0/me/calendarView";
// @fixed: Graph pages a calendar view; a calendar with more pages than this is cut there
const MAX_PAGES = 20;
const FREE = new Set(["free"]);

export interface OutlookOptions {
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
  fetch?: typeof fetch;
}

/** A Graph date-time as a `Date`; one with no offset is UTC, none at all is an invalid date. */
function graphDate(v: string | undefined): Date {
  if (!v) return new Date("invalid");
  const hasOffset = /(?:[zZ]|[+-]\d\d:?\d\d)$/.test(v);
  return new Date(hasOffset ? v : v + "Z");
}

export function outlookSource(options: OutlookOptions): ConnectableSource {
  const doFetch = options.fetch ?? fetch;
  const MAIN: CalendarRef = { id: "primary", name: "Outlook" };
  const accessToken = async (): Promise<string> => {
    if (!options.refreshToken) throw new CalendarSourceError("AK_CAL_UNAUTHORIZED", false);
    const t = await postForm(doFetch, `${AUTHORITY}/token`, { grant_type: "refresh_token", refresh_token: options.refreshToken, client_id: options.clientId, client_secret: options.clientSecret, scope: OUTLOOK_SCOPE });
    const token = str(t.access_token);
    if (!token) throw new CalendarSourceError("AK_CAL_UNAUTHORIZED", false);
    return token;
  };
  return {
    kind: "outlook",
    authorizeUrl({ state, redirectUri, codeChallenge, loginHint }) {
      const q = new URLSearchParams({ client_id: options.clientId, redirect_uri: redirectUri, response_type: "code", response_mode: "query", scope: OUTLOOK_SCOPE, prompt: "consent", code_challenge: codeChallenge, code_challenge_method: "S256", state });
      if (loginHint) q.set("login_hint", loginHint);
      return `${AUTHORITY}/authorize?${q}`;
    },
    async exchange({ code, redirectUri, codeVerifier }): Promise<Grant> {
      const t = await postForm(doFetch, `${AUTHORITY}/token`, { grant_type: "authorization_code", code, code_verifier: codeVerifier, redirect_uri: redirectUri, client_id: options.clientId, client_secret: options.clientSecret, scope: OUTLOOK_SCOPE });
      const refresh = str(t.refresh_token);
      if (!refresh) throw new CalendarSourceError("AK_CAL_UNAUTHORIZED", false, "no refresh token granted");
      return { secret: refresh, calendars: [MAIN] };
    },
    async listCalendars() {
      return [MAIN];
    },
    async busy(range: BusyRange): Promise<BusyResult> {
      const token = await accessToken();
      const busy: BusyInterval[] = [];
      const first = new URLSearchParams({ startDateTime: range.from.toISOString(), endDateTime: range.to.toISOString(), $select: "start,end,showAs,isCancelled", $top: "100" });
      let next: string | undefined = `${VIEW}?${first}`;
      for (let page = 0; next && page < MAX_PAGES; page++) {
        let res: Response;
        try {
          res = await doFetch(next, { headers: { authorization: `Bearer ${token}`, prefer: 'outlook.timezone="UTC"' }, signal: AbortSignal.timeout(15_000) });
        } catch {
          throw new CalendarSourceError("AK_CAL_UNREACHABLE", true);
        }
        const body = (await jsonOf(res)) as { value?: { start?: { dateTime?: string }; end?: { dateTime?: string }; showAs?: string; isCancelled?: boolean }[]; "@odata.nextLink"?: string };
        for (const e of body.value ?? []) {
          if (e.isCancelled || FREE.has(e.showAs ?? "")) continue;
          // With the UTC preference Graph writes « 2026-10-27T14:00:00.0000000 » with no offset: it is UTC.
          const [startsAt, endsAt] = [e.start?.dateTime, e.end?.dateTime].map(graphDate);
          if (!Number.isNaN(startsAt!.getTime()) && !Number.isNaN(endsAt!.getTime())) busy.push({ startsAt: startsAt!, endsAt: endsAt! });
        }
        next = body["@odata.nextLink"];
      }
      return { changed: true, busy: mergeBusy(busy), validators: { etag: null, lastModified: null } };
    },
    async revoke() {
      // Nothing to call: see the note above.
    },
  };
}
