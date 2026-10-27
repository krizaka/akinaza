import { type BusyRange, type BusyResult, type CalendarSource, CalendarSourceError, parseBusy, type Validators } from "@akinaza/core";

import { assertPublicHost, parseCalendarUrl, type Resolver } from "./public-url";

// @fixed: the biggest calendar file read (5 MB: years of events are a few hundred kilobytes), the redirects followed, and the time given to one answer
const MAX_BYTES = 5_000_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 15_000;

export interface IcsUrlOptions {
  url: string;
  /** The shop's zone: floating and all-day times are read in it. */
  timezone: string;
  fetch?: typeof fetch;
  resolve?: Resolver;
}

async function readLimited(res: Response): Promise<string> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) throw new CalendarSourceError("AK_CAL_TOO_LARGE", false);
  const reader = res.body?.getReader();
  if (!reader) return res.text();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new CalendarSourceError("AK_CAL_TOO_LARGE", false);
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

async function request(doFetch: typeof fetch, url: URL, validators: Validators): Promise<Response> {
  const headers: Record<string, string> = { accept: "text/calendar, text/plain;q=0.5", "user-agent": "Akinaza-calendar-sync" };
  if (validators.etag) headers["if-none-match"] = validators.etag;
  if (validators.lastModified) headers["if-modified-since"] = validators.lastModified;
  try {
    return await doFetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new CalendarSourceError("AK_CAL_UNREACHABLE", true);
  }
}

/** What a refusing or failing answer means for the sync: slow down, stop asking, or try again later. */
function failOnStatus(res: Response): void {
  if (res.status === 429) throw new CalendarSourceError("AK_CAL_RATE_LIMITED", true);
  if ([401, 403, 404, 410].includes(res.status)) throw new CalendarSourceError("AK_CAL_REFUSED", false);
  if (!res.ok) throw new CalendarSourceError("AK_CAL_UNREACHABLE", res.status >= 500);
}

/** An ICS address (« subscribe by URL » of Google, Apple, Outlook, Fastmail…): read-only, polled with `ETag` / `If-Modified-Since` (ADR-004). */
export function icsUrlSource(options: IcsUrlOptions): CalendarSource {
  const doFetch = options.fetch ?? fetch;
  return {
    kind: "ics",
    async busy(range: BusyRange, validators: Validators): Promise<BusyResult> {
      let url = parseCalendarUrl(options.url);
      for (let hop = 0; ; hop++) {
        await assertPublicHost(url, options.resolve);
        const res = await request(doFetch, url, validators);
        if (res.status === 304) return { changed: false };
        if (res.status >= 300 && res.status < 400) {
          const next = res.headers.get("location");
          if (!next || hop >= MAX_REDIRECTS) throw new CalendarSourceError("AK_CAL_UNREACHABLE", false, "too many redirects");
          url = parseCalendarUrl(new URL(next, url).toString());
          continue;
        }
        failOnStatus(res);
        const text = await readLimited(res);
        if (!/^\s*BEGIN:VCALENDAR/i.test(text)) throw new CalendarSourceError("AK_CAL_INVALID", false, "not a calendar");
        return {
          changed: true,
          busy: parseBusy(text, { ...range, timezone: options.timezone }),
          validators: { etag: res.headers.get("etag"), lastModified: res.headers.get("last-modified") },
        };
      }
    },
  };
}
