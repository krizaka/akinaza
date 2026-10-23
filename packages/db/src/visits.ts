import { createHash, randomBytes } from "node:crypto";

import { consentsInForce, type DependantProfile, localDay, sniffImage, visitMinutes } from "@akinaza/core";
import { addDays } from "date-fns";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import type { Db } from "./client";
import { openField } from "./crypto";
import { appointments, bookings, clientConsents, clients, dependants, mailOutbox, services, shops, shopZones, staff, visitReports } from "./schema";
import { ShopError } from "./service-shop";

/**
 * The visit side of the service-shop model (ADR-001): the walker's day, checking a visit in and out, the report on each
 * booking (note + photo), its private link, the outgoing mail, and the client's right of access and erasure (Loi 25).
 */
const VisitStatus = { Cancelled: "cancelled" } as const;

const refuse = (code: string): never => {
  throw new ShopError(code);
};

export interface DayBooking {
  bookingId: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  dependant: { name: string; kind: "dog" | "cat" | "other"; profile: DependantProfile };
  hasAccessNotes: boolean;
  report: { id: string; note: string; hasPhoto: boolean; durationMinutes: number; sentAt: string | null } | null;
}

export interface DayVisit {
  appointmentId: string;
  startsAt: string;
  endsAt: string;
  status: "booked" | "done" | "cancelled" | "noShow";
  service: { fr: string; en: string; capacity: number };
  zone: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  bookings: DayBooking[];
}

/** The worker's visits of one local day (cancelled ones excluded), with who and what is booked on each. */
/** Narrows an agenda to the appointments assigned to one person (a staff member's own agenda); absent, the whole shop's. */
export interface AgendaScope {
  staffAccountId?: string;
}

const assignedTo = (staffAccountId: string) => sql`${appointments.staffId} IN (SELECT ${staff.id} FROM ${staff} WHERE ${staff.accountId} = ${staffAccountId})`;

export async function dayVisits(db: Db, shopId: string, day: string, scope: AgendaScope = {}): Promise<DayVisit[]> {
  const [shop] = await db.select({ timezone: shops.timezone }).from(shops).where(eq(shops.id, shopId));
  if (!shop) return refuse("AK_SHOP_UNKNOWN");
  const visits = await db
    .select({ a: appointments, nameFr: services.nameFr, nameEn: services.nameEn, capacity: services.capacity, zone: shopZones.name, start: sql<string>`lower(${appointments.during})`, end: sql<string>`upper(${appointments.during})` })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .leftJoin(shopZones, eq(shopZones.id, appointments.zoneId))
    .where(and(eq(appointments.shopId, shopId), scope.staffAccountId ? assignedTo(scope.staffAccountId) : undefined, sql`${appointments.status} <> 'cancelled'`, sql`(lower(${appointments.during}) AT TIME ZONE ${shop.timezone})::date = ${day}::date`))
    .orderBy(sql`lower(${appointments.during})`);
  if (visits.length === 0) return [];
  const rows = await db
    .select({
      bookingId: bookings.id,
      appointmentId: bookings.appointmentId,
      clientId: clients.id,
      clientName: clients.fullName,
      clientPhone: clients.phone,
      hasNotes: sql<boolean>`${clients.accessNotesEnc} IS NOT NULL`,
      dKind: dependants.kind,
      dName: dependants.name,
      dProfile: dependants.profile,
      reportId: visitReports.id,
      note: visitReports.note,
      hasPhoto: sql<boolean>`${visitReports.photo} IS NOT NULL`,
      minutes: visitReports.durationMinutes,
      sentAt: visitReports.sentAt,
    })
    .from(bookings)
    .innerJoin(clients, eq(clients.id, bookings.clientId))
    .innerJoin(dependants, eq(dependants.id, bookings.dependantId))
    .leftJoin(visitReports, eq(visitReports.bookingId, bookings.id))
    .where(and(inArray(bookings.appointmentId, visits.map((v) => v.a.id)), eq(bookings.status, "booked")))
    .orderBy(asc(dependants.name));
  return visits.map((v) => ({
    appointmentId: v.a.id,
    startsAt: new Date(v.start).toISOString(),
    endsAt: new Date(v.end).toISOString(),
    status: v.a.status,
    service: { fr: v.nameFr, en: v.nameEn, capacity: v.capacity },
    zone: v.zone,
    checkedInAt: v.a.checkedInAt?.toISOString() ?? null,
    checkedOutAt: v.a.checkedOutAt?.toISOString() ?? null,
    bookings: rows
      .filter((r) => r.appointmentId === v.a.id)
      .map((r) => ({
        bookingId: r.bookingId,
        clientId: r.clientId,
        clientName: r.clientName,
        clientPhone: r.clientPhone,
        dependant: { name: r.dName, kind: r.dKind, profile: r.dProfile as DependantProfile },
        hasAccessNotes: r.hasNotes,
        report: r.reportId ? { id: r.reportId, note: r.note!, hasPhoto: r.hasPhoto, durationMinutes: r.minutes!, sentAt: r.sentAt?.toISOString() ?? null } : null,
      })),
  }));
}

// @fixed: a calendar screen draws a month; a quarter is the most a phone asks for at once
const CALENDAR_MAX_DAYS = 93;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export interface CalendarDay {
  day: string;
  visits: number;
  bookings: number;
}

/** What the walker's calendar shows: per local day of `from`..`to` (both included), how many visits and bookings there are (cancelled ones excluded). */
export async function visitDays(db: Db, shopId: string, from: string, to: string, scope: AgendaScope = {}): Promise<CalendarDay[]> {
  if (!DAY.test(from) || !DAY.test(to) || from > to || (Date.parse(to) - Date.parse(from)) / 86_400_000 >= CALENDAR_MAX_DAYS) return refuse("AK_RANGE_INVALID");
  const [shop] = await db.select({ timezone: shops.timezone }).from(shops).where(eq(shops.id, shopId));
  if (!shop) return refuse("AK_SHOP_UNKNOWN");
  const rows = await db.execute(sql`
    SELECT to_char((lower(a.during) AT TIME ZONE ${shop.timezone})::date, 'YYYY-MM-DD') AS day,
           count(DISTINCT a.id)::int AS visits,
           count(b.id)::int AS bookings
      FROM appointments a
      LEFT JOIN bookings b ON b.appointment_id = a.id AND b.status = 'booked'
     WHERE a.shop_id = ${shopId} AND a.status <> 'cancelled'
       ${scope.staffAccountId ? sql`AND a.staff_id IN (SELECT s.id FROM staff s WHERE s.account_id = ${scope.staffAccountId})` : sql``}
       AND (lower(a.during) AT TIME ZONE ${shop.timezone})::date BETWEEN ${from}::date AND ${to}::date
     GROUP BY 1 ORDER BY 1`);
  return rows.rows as unknown as CalendarDay[];
}

/** The shop's local day for an instant — what "today" is for the walker. */
export async function shopDay(db: Db, shopId: string, now: Date): Promise<string> {
  const [shop] = await db.select({ timezone: shops.timezone }).from(shops).where(eq(shops.id, shopId));
  if (!shop) return refuse("AK_SHOP_UNKNOWN");
  return localDay(now, shop.timezone);
}

async function lockedVisit(tx: Pick<Db, "execute">, shopId: string, appointmentId: string) {
  const found = await tx.execute(sql`SELECT status, checked_in_at, checked_out_at FROM appointments WHERE id = ${appointmentId} AND shop_id = ${shopId} FOR UPDATE`);
  return (found.rows[0] as { status: string; checked_in_at: string | null; checked_out_at: string | null } | undefined) ?? refuse("AK_VISIT_UNKNOWN");
}

/** The walker starts a visit. Once; a cancelled visit cannot start. */
export async function checkIn(db: Db, shopId: string, appointmentId: string, at: Date): Promise<void> {
  await db.transaction(async (tx) => {
    const visit = await lockedVisit(tx, shopId, appointmentId);
    if (visit.status === VisitStatus.Cancelled) refuse("AK_VISIT_CANCELLED");
    if (visit.checked_in_at) refuse("AK_ALREADY_CHECKED_IN");
    await tx.update(appointments).set({ checkedInAt: at }).where(eq(appointments.id, appointmentId));
  });
}

/** The walker ends a visit that started: the visit is done and its reports can be written. */
export async function checkOut(db: Db, shopId: string, appointmentId: string, at: Date): Promise<{ minutes: number }> {
  return db.transaction(async (tx) => {
    const visit = await lockedVisit(tx, shopId, appointmentId);
    if (!visit.checked_in_at) return refuse("AK_NOT_CHECKED_IN");
    if (visit.checked_out_at) return refuse("AK_ALREADY_CHECKED_OUT");
    await tx.update(appointments).set({ checkedOutAt: at, status: "done" }).where(eq(appointments.id, appointmentId));
    return { minutes: visitMinutes(new Date(visit.checked_in_at), at) };
  });
}

export interface ReportInput {
  shopId: string;
  bookingId: string;
  note: string;
  /** `undefined` keeps the photo already there, `null` removes it. */
  photo?: { bytes: Buffer } | null;
}

const MAX_NOTE = 1000;
// @fixed: the column's CHECK (octet_length <= 1.5 MB) — a technical bound on what one mail-sized photo may weigh.
const MAX_PHOTO_BYTES = 1_572_864;

/** Writes (or rewrites) the report of a booking whose visit is over. The photo is recognised by its bytes. */
export async function saveReport(db: Db, input: ReportInput): Promise<{ reportId: string; created: boolean }> {
  const note = input.note.trim();
  if (note.length < 1 || note.length > MAX_NOTE) refuse("AK_NOTE_INVALID");
  let photo: { bytes: Buffer; type: "jpeg" | "png" | "webp" } | null | undefined;
  if (input.photo === undefined) photo = undefined;
  else if (input.photo === null) photo = null;
  else {
    const type = sniffImage(input.photo.bytes);
    if (!type) return refuse("AK_PHOTO_INVALID");
    if (input.photo.bytes.length > MAX_PHOTO_BYTES) return refuse("AK_PHOTO_TOO_LARGE");
    photo = { bytes: input.photo.bytes, type };
  }
  return db.transaction(async (tx) => {
    const found = await tx.execute(sql`
      SELECT a.checked_in_at, a.checked_out_at FROM bookings b JOIN appointments a ON a.id = b.appointment_id
       WHERE b.id = ${input.bookingId} AND a.shop_id = ${input.shopId} AND b.status = 'booked' FOR UPDATE OF b`);
    const visit = found.rows[0] as { checked_in_at: string | null; checked_out_at: string | null } | undefined;
    if (!visit) return refuse("AK_BOOKING_UNKNOWN");
    if (!visit.checked_in_at || !visit.checked_out_at) return refuse("AK_VISIT_NOT_DONE");
    const minutes = visitMinutes(new Date(visit.checked_in_at), new Date(visit.checked_out_at));
    const [existing] = await tx.select({ id: visitReports.id }).from(visitReports).where(eq(visitReports.bookingId, input.bookingId));
    if (existing) {
      await tx.update(visitReports).set({ note, durationMinutes: minutes, ...(photo === undefined ? {} : photo === null ? { photo: null, photoType: null } : { photo: photo.bytes, photoType: photo.type }) }).where(eq(visitReports.id, existing.id));
      return { reportId: existing.id, created: false };
    }
    // The link is born unusable (a random hash nobody holds); `issueReportLink` makes the real one when the report is sent.
    const [row] = await tx
      .insert(visitReports)
      .values({ bookingId: input.bookingId, note, durationMinutes: minutes, photo: photo?.bytes ?? null, photoType: photo?.type ?? null, viewTokenHash: reportTokenHash(`unused.${randomBytes(32).toString("base64url")}`), tokenExpiresAt: new Date(0) })
      .returning({ id: visitReports.id });
    return { reportId: row!.id, created: true };
  });
}

const REPORT_TOKEN = /^rp1\.[A-Za-z0-9_-]{43}$/;
export const isReportToken = (value: unknown): value is string => typeof value === "string" && REPORT_TOKEN.test(value);
/** 256 random bits: a plain SHA-256 is enough to keep only a hash. */
export const reportTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export interface ReportMailContext {
  reportId: string;
  token: string;
  expiresAt: Date;
  to: string;
  language: "fr" | "en";
  clientName: string;
  dependantName: string;
  shopName: string;
  service: { fr: string; en: string };
  startsAt: string;
  durationMinutes: number;
  note: string;
  hasPhoto: boolean;
}

/**
 * Makes the report's private link (a fresh token each time: the earlier one stops working), valid `report_link_days`,
 * and returns what the e-mail says. Refused when the client erased their file, has no e-mail, or withdrew the service
 * consent (Loi 25): nothing is sent to someone who did not agree.
 */
export async function issueReportLink(db: Db, shopId: string, bookingId: string, now: Date): Promise<ReportMailContext> {
  return db.transaction(async (tx) => {
    const found = await tx.execute(sql`
      SELECT r.id AS report_id, r.note, r.duration_minutes, (r.photo IS NOT NULL) AS has_photo,
             c.id AS client_id, c.full_name, c.email, c.language, c.erased_at, d.name AS dependant_name, s.name AS shop_name,
             sv.name_fr, sv.name_en, lower(a.during) AS starts_at, sr.report_link_days
        FROM visit_reports r JOIN bookings b ON b.id = r.booking_id JOIN appointments a ON a.id = b.appointment_id
        JOIN clients c ON c.id = b.client_id JOIN dependants d ON d.id = b.dependant_id JOIN shops s ON s.id = a.shop_id
        JOIN services sv ON sv.id = a.service_id JOIN shop_rules sr ON sr.shop_id = a.shop_id
       WHERE b.id = ${bookingId} AND a.shop_id = ${shopId} FOR UPDATE OF r`);
    const row = found.rows[0] as
      | { report_id: string; note: string; duration_minutes: number; has_photo: boolean; client_id: string; full_name: string; email: string | null; language: "fr" | "en"; erased_at: string | null; dependant_name: string; shop_name: string; name_fr: string; name_en: string; starts_at: string; report_link_days: number }
      | undefined;
    if (!row) return refuse("AK_NO_REPORT");
    if (row.erased_at || !row.email) return refuse("AK_CLIENT_UNREACHABLE");
    const history = await tx.select().from(clientConsents).where(eq(clientConsents.clientId, row.client_id)).orderBy(desc(clientConsents.id));
    if (!consentsInForce(history.map((h) => ({ purpose: h.purpose, granted: h.granted, textVersion: h.textVersion, at: h.at }))).service) refuse("AK_NO_CONSENT");
    const token = `rp1.${randomBytes(32).toString("base64url")}`;
    const expiresAt = addDays(now, row.report_link_days);
    await tx.update(visitReports).set({ viewTokenHash: reportTokenHash(token), tokenExpiresAt: expiresAt }).where(eq(visitReports.id, row.report_id));
    return {
      reportId: row.report_id,
      token,
      expiresAt,
      to: row.email,
      language: row.language,
      clientName: row.full_name,
      dependantName: row.dependant_name,
      shopName: row.shop_name,
      service: { fr: row.name_fr, en: row.name_en },
      startsAt: new Date(row.starts_at).toISOString(),
      durationMinutes: row.duration_minutes,
      note: row.note,
      hasPhoto: row.has_photo,
    };
  });
}

export async function markReportSent(db: Db, reportId: string, at: Date): Promise<void> {
  await db.update(visitReports).set({ sentAt: at }).where(eq(visitReports.id, reportId));
}

export interface ReportView {
  id: string;
  shopName: string;
  dependantName: string;
  service: { fr: string; en: string };
  startsAt: string;
  durationMinutes: number;
  note: string;
  hasPhoto: boolean;
}

const viewColumns = sql`r.id, s.name AS shop_name, d.name AS dependant_name, sv.name_fr, sv.name_en, lower(a.during) AS starts_at, r.duration_minutes, r.note, (r.photo IS NOT NULL) AS has_photo`;
const viewJoins = sql`FROM visit_reports r JOIN bookings b ON b.id = r.booking_id JOIN appointments a ON a.id = b.appointment_id JOIN dependants d ON d.id = b.dependant_id JOIN shops s ON s.id = a.shop_id JOIN services sv ON sv.id = a.service_id`;
type ViewRow = { id: string; shop_name: string; dependant_name: string; name_fr: string; name_en: string; starts_at: string; duration_minutes: number; note: string; has_photo: boolean };
const toView = (r: ViewRow): ReportView => ({ id: r.id, shopName: r.shop_name, dependantName: r.dependant_name, service: { fr: r.name_fr, en: r.name_en }, startsAt: new Date(r.starts_at).toISOString(), durationMinutes: r.duration_minutes, note: r.note, hasPhoto: r.has_photo });

/** The report behind a private link, while the link lives. */
export async function reportByToken(db: Db, token: string, now: Date): Promise<ReportView | null> {
  if (!isReportToken(token)) return null;
  const found = await db.execute(sql`SELECT ${viewColumns} ${viewJoins} WHERE r.view_token_hash = ${reportTokenHash(token)} AND r.token_expires_at > ${now.toISOString()}::timestamptz`);
  const row = found.rows[0] as ViewRow | undefined;
  return row ? toView(row) : null;
}

/** The photo of a report: by the private link (while it lives) — or for the client who owns the booking. */
export async function reportPhoto(db: Db, by: { token: string; now: Date } | { clientId: string; reportId: string }): Promise<{ bytes: Buffer; type: "jpeg" | "png" | "webp" } | null> {
  const found =
    "token" in by
      ? isReportToken(by.token)
        ? await db.execute(sql`SELECT photo, photo_type FROM visit_reports WHERE view_token_hash = ${reportTokenHash(by.token)} AND token_expires_at > ${by.now.toISOString()}::timestamptz AND photo IS NOT NULL`)
        : null
      : await db.execute(sql`SELECT r.photo, r.photo_type FROM visit_reports r JOIN bookings b ON b.id = r.booking_id WHERE r.id = ${by.reportId} AND b.client_id = ${by.clientId} AND r.photo IS NOT NULL`);
  const row = found?.rows[0] as { photo: Buffer; photo_type: "jpeg" | "png" | "webp" } | undefined;
  return row ? { bytes: row.photo, type: row.photo_type } : null;
}

export interface ClientBooking {
  bookingId: string;
  appointmentId: string;
  status: "booked" | "cancelled";
  visitStatus: "booked" | "done" | "cancelled" | "noShow";
  startsAt: string;
  service: { fr: string; en: string };
  zone: string | null;
  dependantName: string;
  report: ReportView | null;
}

/** A client's bookings at their shops, newest visit first, each with its report once there is one. */
export async function clientBookings(db: Db, clientId: string): Promise<ClientBooking[]> {
  const found = await db.execute(sql`
    SELECT b.id AS booking_id, a.id AS appointment_id, b.status, a.status AS visit_status, lower(a.during) AS vstart, sv.name_fr, sv.name_en, z.name AS zone, d.name AS dep,
           r.id AS rid, s.name AS shop_name, r.duration_minutes, r.note, (r.photo IS NOT NULL) AS has_photo
      FROM bookings b JOIN appointments a ON a.id = b.appointment_id JOIN services sv ON sv.id = a.service_id JOIN dependants d ON d.id = b.dependant_id
      JOIN shops s ON s.id = a.shop_id LEFT JOIN shop_zones z ON z.id = a.zone_id LEFT JOIN visit_reports r ON r.booking_id = b.id
     WHERE b.client_id = ${clientId} ORDER BY lower(a.during) DESC`);
  type Row = { booking_id: string; appointment_id: string; status: "booked" | "cancelled"; visit_status: ClientBooking["visitStatus"]; vstart: string; name_fr: string; name_en: string; zone: string | null; dep: string; rid: string | null; shop_name: string; duration_minutes: number | null; note: string | null; has_photo: boolean | null };
  return (found.rows as Row[]).map((r) => ({
    bookingId: r.booking_id,
    appointmentId: r.appointment_id,
    status: r.status,
    visitStatus: r.visit_status,
    startsAt: new Date(r.vstart).toISOString(),
    service: { fr: r.name_fr, en: r.name_en },
    zone: r.zone,
    dependantName: r.dep,
    report: r.rid ? { id: r.rid, shopName: r.shop_name, dependantName: r.dep, service: { fr: r.name_fr, en: r.name_en }, startsAt: new Date(r.vstart).toISOString(), durationMinutes: r.duration_minutes!, note: r.note!, hasPhoto: r.has_photo! } : null,
  }));
}

/** The report of one of the client's own bookings (null for anyone else's). */
export async function reportForClient(db: Db, clientId: string, reportId: string): Promise<ReportView | null> {
  const found = await db.execute(sql`SELECT ${viewColumns} ${viewJoins} WHERE r.id = ${reportId} AND b.client_id = ${clientId}`);
  const row = found.rows[0] as ViewRow | undefined;
  return row ? toView(row) : null;
}

/** The walker's list of client files with their dependants (no access notes: those are revealed one at a time). */
export async function shopClients(db: Db, shopId: string) {
  const files = await db.select({ id: clients.id, fullName: clients.fullName, phone: clients.phone, email: clients.email, hasNotes: sql<boolean>`${clients.accessNotesEnc} IS NOT NULL` }).from(clients).where(and(eq(clients.shopId, shopId), isNull(clients.erasedAt))).orderBy(asc(clients.fullName));
  const pets = files.length ? await db.select().from(dependants).where(and(inArray(dependants.clientId, files.map((f) => f.id)), isNull(dependants.erasedAt))).orderBy(asc(dependants.name)) : [];
  return files.map((f) => ({ ...f, dependants: pets.filter((p) => p.clientId === f.id).map((p) => ({ id: p.id, name: p.name, kind: p.kind, profile: p.profile as DependantProfile })) }));
}

export interface OutgoingMail {
  to: string;
  locale: "fr" | "en";
  template: string;
  subject: string;
  html: string;
  text: string;
  relatedKind?: string;
  relatedId?: string;
}

export async function enqueueMail(db: Db, mail: OutgoingMail): Promise<string> {
  const [row] = await db
    .insert(mailOutbox)
    .values({ toEmail: mail.to, locale: mail.locale, template: mail.template, subject: mail.subject, html: mail.html, bodyText: mail.text, relatedKind: mail.relatedKind ?? null, relatedId: mail.relatedId ?? null })
    .returning({ id: mailOutbox.id });
  return row!.id;
}

export async function pendingMail(db: Db, limit = 20) {
  return db.select().from(mailOutbox).where(eq(mailOutbox.status, "pending")).orderBy(asc(mailOutbox.createdAt)).limit(limit);
}

export async function markMailSent(db: Db, id: string, at: Date): Promise<void> {
  await db.update(mailOutbox).set({ status: "sent", sentAt: at, attempts: sql`${mailOutbox.attempts} + 1`, lastError: null }).where(eq(mailOutbox.id, id));
  await db.execute(sql`UPDATE visit_reports SET sent_at = ${at.toISOString()}::timestamptz WHERE id = (SELECT related_id FROM mail_outbox WHERE id = ${id} AND related_kind = 'visit_report')`);
}

export async function mailById(db: Db, id: string) {
  const [row] = await db.select().from(mailOutbox).where(eq(mailOutbox.id, id));
  return row ?? null;
}

/** A failed or unconfigured attempt: the mail stays `pending` until `maxAttempts`, then `failed`. Returns which. */
export async function markMailAttempt(db: Db, id: string, error: string, maxAttempts: number): Promise<"pending" | "failed"> {
  const result = await db.execute(sql`UPDATE mail_outbox SET attempts = attempts + 1, last_error = ${error.slice(0, 300)}, status = CASE WHEN attempts + 1 >= ${maxAttempts} THEN 'failed' ELSE 'pending' END WHERE id = ${id} RETURNING status`);
  return (result.rows[0] as { status: "pending" | "failed" }).status;
}

/** Everything held about a client, in one object — their right of access (Loi 25). Access notes are opened for them. */
export async function exportClient(db: Db, key: Buffer, clientId: string) {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!client || client.erasedAt) return refuse("AK_CLIENT_UNKNOWN");
  const [shop] = await db.select({ name: shops.name }).from(shops).where(eq(shops.id, client.shopId));
  const consents = await db.select().from(clientConsents).where(eq(clientConsents.clientId, clientId)).orderBy(asc(clientConsents.id));
  const pets = await db.select().from(dependants).where(eq(dependants.clientId, clientId)).orderBy(asc(dependants.name));
  const visits = await clientBookings(db, clientId);
  const photos = await db.execute(sql`SELECT r.id, encode(r.photo, 'base64') AS data, r.photo_type FROM visit_reports r JOIN bookings b ON b.id = r.booking_id WHERE b.client_id = ${clientId} AND r.photo IS NOT NULL`);
  return {
    exportedFor: "Loi 25 — right of access",
    shop: shop?.name ?? null,
    file: { fullName: client.fullName, email: client.email, phone: client.phone, language: client.language, notes: client.notes, createdAt: client.createdAt.toISOString(), accessNotes: client.accessNotesEnc ? openField(client.accessNotesEnc, key, clientId) : null },
    consents: consents.map((c) => ({ purpose: c.purpose, granted: c.granted, textVersion: c.textVersion, at: c.at.toISOString() })),
    dependants: pets.map((p) => ({ kind: p.kind, name: p.name, profile: p.profile })),
    bookings: visits.map((v) => ({ startsAt: v.startsAt, service: v.service, zone: v.zone, dependant: v.dependantName, status: v.status, report: v.report ? { note: v.report.note, durationMinutes: v.report.durationMinutes, photoId: v.report.hasPhoto ? v.report.id : null } : null })),
    photos: (photos.rows as { id: string; data: string; photo_type: string }[]).map((p) => ({ reportId: p.id, type: p.photo_type, base64: p.data })),
  };
}
