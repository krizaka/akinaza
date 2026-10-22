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
