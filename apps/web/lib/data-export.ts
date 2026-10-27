import type { AppointmentExportRow, ClientExportRow, InvoiceExportRow } from "@akinaza/db";

import { escape, fold, stamp } from "@/lib/ics";

/**
 * The owner's data exports (#420, ADR-004 §5), as text: CSV (RFC 4180, UTF-8 with a byte-order mark so a spreadsheet reads the accents) and
 * an iCalendar file. Pure: the rows come from `@akinaza/db` (`exports.ts`), the words from the messages, the route streams the result.
 */

export const EXPORT_KINDS = ["appointments", "clients", "invoices"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];
export type ExportFormat = "csv" | "ics";

/** The files on offer: `appointments.csv`, `appointments.ics`, `clients.csv`, `invoices.csv`. */
export const EXPORT_FILES = ["appointments.csv", "appointments.ics", "clients.csv", "invoices.csv"] as const;
export type ExportFile = (typeof EXPORT_FILES)[number];
export const isExportFile = (value: string): value is ExportFile => (EXPORT_FILES as readonly string[]).includes(value);
export const kindOf = (file: ExportFile): ExportKind => file.split(".")[0] as ExportKind;
export const formatOf = (file: ExportFile): ExportFormat => file.split(".")[1] as ExportFormat;

export const BOM = "\uFEFF";

/**
 * One text cell. A cell that a spreadsheet would read as a formula (starts with = + - @ or a control character) is prefixed with an apostrophe,
 * so a client named `=HYPERLINK(...)` is text, never a command. Quotes, commas and line breaks are quoted.
 */
export function csvCell(value: string | null | undefined): string {
  return quoted(guarded(value ?? ""));
}

const guarded = (raw: string): string => (/^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw);
const quoted = (safe: string): string => (/[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe);

export const csvLine = (cells: readonly (string | null | undefined)[]): string => `${cells.map(csvCell).join(",")}\r\n`;

/** An amount in dollars with two decimals, from cents: `1250` becomes `12.50`; a number, so never guarded. */
export const dollars = (cents: number): string => (cents / 100).toFixed(2);

/** A date and time as the shop's clock reads it: `2026-11-20 10:00`. */
export function localDateTime(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at).replace(/[\u202f\u00a0]/g, " ");
}

/** The words of the exports, from the messages (`console.exports`). */
export interface ExportWords {
  columns: { appointments: Record<"id" | "start" | "end" | "status" | "service" | "staff" | "client" | "price", string>; clients: Record<"id" | "name" | "email" | "phone" | "language" | "since" | "dependants", string>; invoices: Record<"number" | "issuedOn" | "dueOn" | "client" | "subtotal" | "gst" | "qst" | "total" | "paid" | "creditOf" | "state" | "language", string> };
  status: Record<AppointmentExportRow["status"], string>;
  invoiceState: Record<"open" | "paid" | "superseded", string>;
}

// The columns in the order of the rows below; the header is read from this list so the two cannot drift apart.
export const APPOINTMENT_COLUMNS = ["id", "start", "end", "status", "service", "staff", "client", "price"] as const;
export const CLIENT_COLUMNS = ["id", "name", "email", "phone", "language", "since", "dependants"] as const;
export const INVOICE_COLUMNS = ["number", "issuedOn", "dueOn", "client", "subtotal", "gst", "qst", "total", "paid", "creditOf", "state", "language"] as const;

export const appointmentsHeader = (w: ExportWords) => csvLine(APPOINTMENT_COLUMNS.map((c) => w.columns.appointments[c]));
export const clientsHeader = (w: ExportWords) => csvLine(CLIENT_COLUMNS.map((c) => w.columns.clients[c]));
export const invoicesHeader = (w: ExportWords) => csvLine(INVOICE_COLUMNS.map((c) => w.columns.invoices[c]));

const serviceName = (r: AppointmentExportRow, locale: "fr" | "en") => ({ fr: r.serviceFr, en: r.serviceEn })[locale];

export const appointmentsCsv = (rows: readonly AppointmentExportRow[], w: ExportWords, locale: "fr" | "en", timeZone: string): string =>
  rows.map((r) => csvLine([r.id, localDateTime(r.startsAt, timeZone), localDateTime(r.endsAt, timeZone), w.status[r.status], serviceName(r, locale), r.staff, r.client, dollars(r.priceCents)])).join("");

export const clientsCsv = (rows: readonly ClientExportRow[], _w: ExportWords, timeZone: string): string =>
  rows.map((r) => csvLine([r.id, r.fullName, r.email, r.phone, r.language, localDateTime(r.createdAt, timeZone).slice(0, 10), r.dependants.join("; ")])).join("");

function invoiceState(r: InvoiceExportRow): "open" | "paid" | "superseded" {
  if (r.superseded) return "superseded";
  return r.paidCents >= r.totalCents && r.totalCents > 0 ? "paid" : "open";
}

export const invoicesCsv = (rows: readonly InvoiceExportRow[], w: ExportWords): string =>
  rows.map((r) => csvLine([r.number, r.issuedOn, r.dueOn, r.client, dollars(r.subtotalCents), dollars(r.gstCents), dollars(r.qstCents), dollars(r.totalCents), dollars(r.paidCents), r.creditOf, w.invoiceState[invoiceState(r)], r.language])).join("");

/** The opening and closing of the appointments calendar file. */
export const icsOpen = (name: string): string =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Akinaza//Export//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${escape(name)}`].map(fold).join("\r\n") + "\r\n";
export const icsClose = (): string => "END:VCALENDAR\r\n";

const ICS_STATUS: Record<AppointmentExportRow["status"], "CONFIRMED" | "CANCELLED"> = { booked: "CONFIRMED", done: "CONFIRMED", noShow: "CONFIRMED", cancelled: "CANCELLED" };

/** One event per appointment: « Service · Client », the staff member and the status. Only what the owner's own agenda shows. */
export function appointmentsIcs(rows: readonly AppointmentExportRow[], w: ExportWords, locale: "fr" | "en", now: Date): string {
  return rows
    .map((r) => {
      const service = serviceName(r, locale);
      const lines = [
        "BEGIN:VEVENT",
        `UID:${r.id}@akinaza.com`,
        `DTSTAMP:${stamp(now)}`,
        `DTSTART:${stamp(r.startsAt)}`,
        `DTEND:${stamp(r.endsAt)}`,
        `SUMMARY:${escape([service, r.client].filter(Boolean).join(" · "))}`,
        `DESCRIPTION:${escape([r.staff, w.status[r.status]].join(" · "))}`,
        `STATUS:${ICS_STATUS[r.status]}`,
        "END:VEVENT",
      ];
      return `${lines.map(fold).join("\r\n")}\r\n`;
    })
    .join("");
}
