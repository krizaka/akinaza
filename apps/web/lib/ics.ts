/** An iCalendar (RFC 5545) event: what « add to calendar » downloads. Pure: times in UTC, text escaped, lines folded at 75 octets. */
export interface IcsEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  location?: string;
  description?: string;
  /** When the file is made (DTSTAMP). */
  now: Date;
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const escape = (text: string) => text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// @fixed: RFC 5545 §3.1 — a content line is folded before 75 octets
const FOLD = 75;

function fold(line: string): string {
  const bytes = new TextEncoder();
  const out: string[] = [];
  let current = "";
  for (const ch of line) {
    const limit = out.length === 0 ? FOLD : FOLD - 1;
    if (bytes.encode(current + ch).length > limit) {
      out.push(current);
      current = ch;
    } else current += ch;
  }
  out.push(current);
  return out.join("\r\n ");
}

export function buildIcs(e: IcsEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Akinaza//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}@akinaza.com`,
    `DTSTAMP:${stamp(e.now)}`,
    `DTSTART:${stamp(e.start)}`,
    `DTEND:${stamp(e.end)}`,
    `SUMMARY:${escape(e.summary)}`,
    ...(e.location ? [`LOCATION:${escape(e.location)}`] : []),
    ...(e.description ? [`DESCRIPTION:${escape(e.description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/** What a private feed says of one appointment: first names and the service, nothing else (ADR-004). */
export interface FeedIcsEntry {
  appointmentId: string;
  start: Date;
  end: Date;
  service: string;
  firstNames: string[];
}

/**
 * The private calendar feed (RFC 5545) of a shop or a staff member: one event per appointment, « Service · Camille ». No location, description,
 * phone, e-mail or note is ever written: the feed's address is its only secret and it must carry no client's data beyond a first name.
 */
export function buildFeedIcs({ name, entries, now }: { name: string; entries: readonly FeedIcsEntry[]; now: Date }): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Akinaza//Agenda//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(name)}`,
    // @fixed: a hint to calendar apps (RFC 7986): ask again every hour; the app decides
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    ...entries.flatMap((e) => [
      "BEGIN:VEVENT",
      `UID:${e.appointmentId}@akinaza.com`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.end)}`,
      `SUMMARY:${escape([e.service, e.firstNames.join(", ")].filter(Boolean).join(" · "))}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
