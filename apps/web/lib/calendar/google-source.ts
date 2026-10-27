import { type BusyInterval, type BusyRange, type BusyResult, type CalendarRef, CalendarSourceError, type ConnectableSource, type Grant, mergeBusy } from "@akinaza/core";

import { jsonOf, postForm, str } from "./oauth-fetch";

/**
 * Google Calendar, read-only, busy times only: the `calendar.freebusy` scope, the smallest there is (ADR-004). Under it only the primary calendar can
 * be asked (listing the others needs a wider scope, which the first release does not ask for). The grant kept is the refresh token.
 */
export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.freebusy";
const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const REVOKE = "https://oauth2.googleapis.com/revoke";
const FREEBUSY = "https://www.googleapis.com/calendar/v3/freeBusy";

export interface GoogleOptions {
  clientId: string;
  clientSecret: string;
  /** Absent before the owner has consented. */
  refreshToken?: string;
  fetch?: typeof fetch;
}

export function googleSource(options: GoogleOptions): ConnectableSource {
  const doFetch = options.fetch ?? fetch;
  const PRIMARY: CalendarRef = { id: "primary", name: "Google" };
  const accessToken = async (): Promise<string> => {
    if (!options.refreshToken) throw new CalendarSourceError("AK_CAL_UNAUTHORIZED", false);
    const t = await postForm(doFetch, TOKEN, { grant_type: "refresh_token", refresh_token: options.refreshToken, client_id: options.clientId, client_secret: options.clientSecret });
    const token = str(t.access_token);
    if (!token) throw new CalendarSourceError("AK_CAL_UNAUTHORIZED", false);
    return token;
  };
  return {
    kind: "google",
    authorizeUrl({ state, redirectUri, codeChallenge, loginHint }) {
      const q = new URLSearchParams({ client_id: options.clientId, redirect_uri: redirectUri, response_type: "code", scope: GOOGLE_SCOPE, access_type: "offline", prompt: "consent", include_granted_scopes: "false", code_challenge: codeChallenge, code_challenge_method: "S256", state });
      if (loginHint) q.set("login_hint", loginHint);
      return `${AUTH}?${q}`;
    },
    async exchange({ code, redirectUri, codeVerifier }): Promise<Grant> {
      const t = await postForm(doFetch, TOKEN, { grant_type: "authorization_code", code, code_verifier: codeVerifier, redirect_uri: redirectUri, client_id: options.clientId, client_secret: options.clientSecret });
      const refresh = str(t.refresh_token);
      if (!refresh) throw new CalendarSourceError("AK_CAL_UNAUTHORIZED", false, "no refresh token granted");
      return { secret: refresh, calendars: [PRIMARY] };
    },
    async listCalendars() {
      return [PRIMARY];
    },
    async busy(range: BusyRange): Promise<BusyResult> {
      const token = await accessToken();
      let res: Response;
      try {
        res = await doFetch(FREEBUSY, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ timeMin: range.from.toISOString(), timeMax: range.to.toISOString(), items: [{ id: PRIMARY.id }] }), signal: AbortSignal.timeout(15_000) });
      } catch {
        throw new CalendarSourceError("AK_CAL_UNREACHABLE", true);
      }
      const body = (await jsonOf(res)) as { calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }> };
      const cal = body.calendars?.[PRIMARY.id];
      if (!cal || (cal.errors?.length ?? 0) > 0) throw new CalendarSourceError("AK_CAL_REFUSED", false);
      const busy: BusyInterval[] = (cal.busy ?? []).map((b) => ({ startsAt: new Date(b.start), endsAt: new Date(b.end) })).filter((b) => !Number.isNaN(b.startsAt.getTime()) && !Number.isNaN(b.endsAt.getTime()));
      return { changed: true, busy: mergeBusy(busy), validators: { etag: null, lastModified: null } };
    },
    async revoke() {
      if (!options.refreshToken) return;
      await postForm(doFetch, REVOKE, { token: options.refreshToken }).catch(() => undefined);
    },
  };
}
