import { CalendarSourceError } from "@akinaza/core";
import { describe, expect, it, vi } from "vitest";

import { caldavSource, calendarDataOf } from "./caldav-source";
import { GOOGLE_SCOPE, googleSource } from "./google-source";
import { OUTLOOK_SCOPE, outlookSource } from "./outlook-source";

const RANGE = { from: new Date("2026-10-26T00:00:00Z"), to: new Date("2026-12-26T00:00:00Z") };
const NONE = { etag: null, lastModified: null };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const bodyOf = (call: unknown[]) => String((call[1] as RequestInit).body);
const code = async (p: Promise<unknown>) => p.then(() => null, (e: CalendarSourceError) => `${e.code}${e.retryable ? "/retry" : ""}`);

describe("Google (calendar.freebusy only)", () => {
  const app = { clientId: "cid", clientSecret: "csecret" };

  it("asks for the one busy-only scope, offline, with a PKCE challenge, and nothing wider", () => {
    const url = new URL(googleSource(app).authorizeUrl({ state: "st", redirectUri: "https://www.akinaza.com/api/calendars/callback/google", codeChallenge: "chal" }));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("scope")).toBe(GOOGLE_SCOPE);
    expect(GOOGLE_SCOPE).toBe("https://www.googleapis.com/auth/calendar.freebusy");
    expect(url.searchParams.get("code_challenge")).toBe("chal");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("state")).toBe("st");
  });

  it("exchanges the code with the verifier and keeps the refresh token as the secret", async () => {
    const fetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => json({ access_token: "a", refresh_token: "r1" }));
    const grant = await googleSource({ ...app, fetch }).exchange({ code: "c", redirectUri: "https://x/cb", codeVerifier: "ver" });
    expect(grant.secret).toBe("r1");
    const form = new URLSearchParams(bodyOf(fetch.mock.calls[0] as unknown[]));
    expect(form.get("code_verifier")).toBe("ver");
    expect(form.get("grant_type")).toBe("authorization_code");
  });

  it("refuses a consent that gave no refresh token", async () => {
    const fetch = vi.fn(async () => json({ access_token: "a" }));
    expect(await code(googleSource({ ...app, fetch }).exchange({ code: "c", redirectUri: "u", codeVerifier: "v" }))).toBe("AK_CAL_UNAUTHORIZED");
  });

  it("refreshes the access token, then reads only the busy times, merged", async () => {
    const fetch = vi.fn(async (url: RequestInfo | URL) => (String(url).includes("token") ? json({ access_token: "acc" }) : json({ calendars: { primary: { busy: [{ start: "2026-10-27T14:00:00Z", end: "2026-10-27T15:00:00Z" }, { start: "2026-10-27T15:00:00Z", end: "2026-10-27T16:00:00Z" }, { start: "bad", end: "bad" }] } } })));
    const result = await googleSource({ ...app, refreshToken: "r1", fetch }).busy(RANGE, NONE);
    expect(result).toMatchObject({ changed: true, busy: [{ startsAt: new Date("2026-10-27T14:00:00Z"), endsAt: new Date("2026-10-27T16:00:00Z") }] });
    const refresh = new URLSearchParams(bodyOf(fetch.mock.calls[0] as unknown[]));
    expect(refresh.get("grant_type")).toBe("refresh_token");
    expect(refresh.get("refresh_token")).toBe("r1");
    const [, init] = fetch.mock.calls[1] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer acc");
    expect(JSON.parse(String(init.body)).items).toEqual([{ id: "primary" }]);
  });

  it("names the failures: a revoked grant asks to reconnect, a quota waits, an outage retries, a calendar error refuses", async () => {
    const run = (answers: Response[]) => googleSource({ ...app, refreshToken: "r", fetch: vi.fn(async () => answers.shift()!) }).busy(RANGE, NONE);
    expect(await code(run([json({ error: "invalid_grant" }, 400)]))).toBe("AK_CAL_UNAUTHORIZED");
    expect(await code(run([json({ access_token: "a" }), json({}, 401)]))).toBe("AK_CAL_UNAUTHORIZED");
    expect(await code(run([json({ access_token: "a" }), json({}, 429)]))).toBe("AK_CAL_RATE_LIMITED/retry");
    expect(await code(run([json({ access_token: "a" }), json({}, 503)]))).toBe("AK_CAL_UNREACHABLE/retry");
    expect(await code(run([json({ access_token: "a" }), json({ calendars: { primary: { errors: [{}] } } })]))).toBe("AK_CAL_REFUSED");
    expect(await code(googleSource({ ...app, fetch: vi.fn() }).busy(RANGE, NONE))).toBe("AK_CAL_UNAUTHORIZED");
    expect(await code(googleSource({ ...app, refreshToken: "r", fetch: vi.fn(async () => Promise.reject(new Error("down"))) }).busy(RANGE, NONE))).toBe("AK_CAL_UNREACHABLE/retry");
  });

  it("revokes the refresh token at Google, and never fails the disconnection", async () => {
    const fetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => json({}));
    await googleSource({ ...app, refreshToken: "r1", fetch }).revoke();
    expect(String(fetch.mock.calls[0]![0])).toBe("https://oauth2.googleapis.com/revoke");
    expect(new URLSearchParams(bodyOf(fetch.mock.calls[0] as unknown[])).get("token")).toBe("r1");
    await expect(googleSource({ ...app, refreshToken: "r1", fetch: vi.fn(async () => json({}, 500)) }).revoke()).resolves.toBeUndefined();
    await expect(googleSource({ ...app, fetch }).revoke()).resolves.toBeUndefined();
  });
});

describe("Outlook (Calendars.ReadBasic + offline_access)", () => {
  const app = { clientId: "cid", clientSecret: "csecret" };

  it("asks for the least privileged read scope and the refresh token, with PKCE", () => {
    const url = new URL(outlookSource(app).authorizeUrl({ state: "st", redirectUri: "https://www.akinaza.com/api/calendars/callback/outlook", codeChallenge: "chal" }));
    expect(url.origin + url.pathname).toBe("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
    expect(url.searchParams.get("scope")).toBe(OUTLOOK_SCOPE);
    expect(OUTLOOK_SCOPE).toBe("https://graph.microsoft.com/Calendars.ReadBasic offline_access");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("exchanges the code with the verifier", async () => {
    const fetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => json({ access_token: "a", refresh_token: "r2" }));
    expect((await outlookSource({ ...app, fetch }).exchange({ code: "c", redirectUri: "u", codeVerifier: "ver" })).secret).toBe("r2");
    expect(new URLSearchParams(bodyOf(fetch.mock.calls[0] as unknown[])).get("code_verifier")).toBe("ver");
    expect(await code(outlookSource({ ...app, fetch: vi.fn(async () => json({ access_token: "a" })) }).exchange({ code: "c", redirectUri: "u", codeVerifier: "v" }))).toBe("AK_CAL_UNAUTHORIZED");
  });

  it("reads the calendar view page by page, keeps what blocks time (not free, not cancelled), asks for no subject", async () => {
    const pages = [
      json({ access_token: "acc" }),
      json({ value: [{ start: { dateTime: "2026-10-27T14:00:00.0000000" }, end: { dateTime: "2026-10-27T15:00:00.0000000" }, showAs: "busy" }, { start: { dateTime: "2026-10-27T16:00:00.0000000" }, end: { dateTime: "2026-10-27T17:00:00.0000000" }, showAs: "free" }], "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/calendarView?page=2" }),
      json({ value: [{ start: { dateTime: "2026-10-28T09:00:00.0000000" }, end: { dateTime: "2026-10-28T10:00:00.0000000" }, showAs: "oof" }, { start: { dateTime: "2026-10-28T11:00:00.0000000" }, end: { dateTime: "2026-10-28T12:00:00.0000000" }, isCancelled: true }] }),
    ];
    const fetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => pages.shift()!);
    const result = await outlookSource({ ...app, refreshToken: "r", fetch }).busy(RANGE, NONE);
    expect(result).toMatchObject({ changed: true, busy: [{ startsAt: new Date("2026-10-27T14:00:00Z") }, { startsAt: new Date("2026-10-28T09:00:00Z") }] });
    expect(String(fetch.mock.calls[1]![0])).toContain("%24select=start%2Cend%2CshowAs%2CisCancelled");
    expect(String(fetch.mock.calls[1]![0])).not.toContain("subject");
  });

  it("names the failures and has nothing to revoke at Microsoft", async () => {
    const run = (answers: Response[]) => outlookSource({ ...app, refreshToken: "r", fetch: vi.fn(async () => answers.shift()!) }).busy(RANGE, NONE);
    expect(await code(run([json({ error: "invalid_grant" }, 400)]))).toBe("AK_CAL_UNAUTHORIZED");
    expect(await code(run([json({ access_token: "a" }), json({}, 429)]))).toBe("AK_CAL_RATE_LIMITED/retry");
    expect(await code(run([json({ access_token: "a" }), json({}, 500)]))).toBe("AK_CAL_UNREACHABLE/retry");
    expect(await code(outlookSource({ ...app }).busy(RANGE, NONE))).toBe("AK_CAL_UNAUTHORIZED");
    const fetch = vi.fn();
    await outlookSource({ ...app, refreshToken: "r", fetch }).revoke();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("CalDAV (read-only, HTTPS, an app password)", () => {
  const ics = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:a\r\nDTSTART:20261027T140000Z\r\nDTEND:20261027T150000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
  const multistatus = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:propstat><d:prop><c:calendar-data>${ics.replace(/&/g, "&amp;")}</c:calendar-data></d:prop></d:propstat></d:response></d:multistatus>`;
  const options = { url: "https://caldav.example.com/dav/me/calendar/", username: "me@example.com", password: "app-password", timezone: "America/Toronto", resolve: async () => ["93.184.216.34"] };
  const xml = (status: number, body = "") => new Response(body, { status });

  it("sends one REPORT over the window with Basic credentials, and reads the events as busy times", async () => {
    const fetch = vi.fn(async () => xml(207, multistatus));
    const result = await caldavSource({ ...options, fetch }).busy(RANGE, NONE);
    expect(result).toMatchObject({ changed: true, busy: [{ startsAt: new Date("2026-10-27T14:00:00Z"), endsAt: new Date("2026-10-27T15:00:00Z") }] });
    const [, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
    expect(init.method).toBe("REPORT");
    expect((init.headers as Record<string, string>).authorization).toBe(`Basic ${Buffer.from("me@example.com:app-password").toString("base64")}`);
    expect(String(init.body)).toContain('start="20261026T000000Z"');
    expect(init.redirect).toBe("error");
  });

  it("refuses an address that is not public HTTPS before sending the credential", async () => {
    const fetch = vi.fn();
    await expect(caldavSource({ ...options, url: "http://caldav.example.com/x", fetch }).busy(RANGE, NONE)).rejects.toBeInstanceOf(CalendarSourceError);
    await expect(caldavSource({ ...options, resolve: async () => ["10.0.0.5"], fetch }).busy(RANGE, NONE)).rejects.toBeInstanceOf(CalendarSourceError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("names the failures", async () => {
    const run = (status: number) => caldavSource({ ...options, fetch: vi.fn(async () => xml(status)) }).busy(RANGE, NONE);
    expect(await code(run(401))).toBe("AK_CAL_UNAUTHORIZED");
    expect(await code(run(403))).toBe("AK_CAL_REFUSED");
    expect(await code(run(429))).toBe("AK_CAL_RATE_LIMITED/retry");
    expect(await code(run(502))).toBe("AK_CAL_UNREACHABLE/retry");
    expect(await code(caldavSource({ ...options, fetch: vi.fn(async () => Promise.reject(new Error("down"))) }).busy(RANGE, NONE))).toBe("AK_CAL_UNREACHABLE/retry");
  });

  it("reads calendar-data whatever the XML prefix, unescaping it", () => {
    expect(calendarDataOf("<D:multistatus><cal:calendar-data>A &amp; B</cal:calendar-data><calendar-data><![CDATA[C]]></calendar-data></D:multistatus>")).toEqual(["A & B", "C"]);
  });
});
