import { type BusyRange, type BusyResult, type CalendarSource, CalendarSourceError, mergeBusy, parseBusy } from "@akinaza/core";

import { assertPublicHost, parseCalendarUrl, type Resolver } from "./public-url";


/**
 * iCloud and any CalDAV server, read-only (RFC 4791): one `REPORT calendar-query` over the window on the calendar collection the owner gives,
 * over HTTPS, with a Basic credential (for iCloud an app-specific password, never the Apple ID's). Recurring events are expanded by Akinaza
 * (`parseBusy`), so the server is not asked to. Change detection by `sync-token` (RFC 6578) is a later optimisation.
 */
export interface CaldavOptions {
  /** The calendar collection's address. */
  url: string;
  username: string;
  password: string;
  timezone: string;
  fetch?: typeof fetch;
  resolve?: Resolver;
}

const compact = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const unescapeXml = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** The iCalendar bodies of a multistatus answer. */
export function calendarDataOf(xml: string): string[] {
  return [...xml.matchAll(/<(?:[\w-]+:)?calendar-data[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?calendar-data>/gi)].map((m) => unescapeXml(m[1]!));
}

export function caldavSource(options: CaldavOptions): CalendarSource {
  const doFetch = options.fetch ?? fetch;
  return {
    kind: "caldav",
    async busy(range: BusyRange): Promise<BusyResult> {
      const url = parseCalendarUrl(options.url);
      await assertPublicHost(url, options.resolve);
      const body = `<?xml version="1.0" encoding="utf-8"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${compact(range.from)}" end="${compact(range.to)}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`;
      let res: Response;
      try {
        res = await doFetch(url, {
          method: "REPORT",
          headers: { authorization: `Basic ${Buffer.from(`${options.username}:${options.password}`).toString("base64")}`, depth: "1", "content-type": "application/xml; charset=utf-8" },
          body,
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
        });
      } catch {
        throw new CalendarSourceError("AK_CAL_UNREACHABLE", true);
      }
      if (res.status === 401) throw new CalendarSourceError("AK_CAL_UNAUTHORIZED", false);
      if (res.status === 403 || res.status === 404) throw new CalendarSourceError("AK_CAL_REFUSED", false);
      if (res.status === 429) throw new CalendarSourceError("AK_CAL_RATE_LIMITED", true);
      if (res.status !== 207 && !res.ok) throw new CalendarSourceError("AK_CAL_UNREACHABLE", res.status >= 500);
      const xml = await res.text();
      if (xml.length > 10_000_000) throw new CalendarSourceError("AK_CAL_TOO_LARGE", false);
      const busy = calendarDataOf(xml).flatMap((ics) => parseBusy(ics, { ...range, timezone: options.timezone }));
      return { changed: true, busy: mergeBusy(busy), validators: { etag: null, lastModified: null } };
    },
  };
}
