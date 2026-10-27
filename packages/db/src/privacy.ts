import { CONSENT_PURPOSES, type ConsentPurpose } from "@akinaza/core";
import { createPrivacy, dbPrivacyStore, type Privacy, type PrivacyContributor, type Query, type Subject } from "@krizaka/privacy";
import { eq } from "drizzle-orm";
import type pg from "pg";

import type { Db } from "./client";
import { openField } from "./crypto";
import { ShopError } from "./errors";
import { clients, dependants, shops } from "./schema";
import { transactionOn } from "./transaction";

/**
 * Loi 25 for Akinaza (akinaza#370), over `@krizaka/privacy`: consents by purpose, the right of access (an export assembled from every
 * module that holds the client's data) and erasure (every module, one transaction). The data subject is a client file: a kind and an
 * id. The module is the package's; this file only says what Akinaza holds and what erasing it means. What tax law keeps (invoices,
 * their lines, payments, the ledger) stays, and `eraseFor` blanks the personal fields around it (`RETENTION_RULES`, `@akinaza/core`).
 */
export const CLIENT_SUBJECT_KIND = "client";
export const clientSubject = (clientId: string): Subject => ({ kind: CLIENT_SUBJECT_KIND, id: clientId });

const refuse = (code: string): never => {
  throw new ShopError(code);
};

const poolOf = (db: Db) => db.$client as pg.Pool;

/** A SQL runner over the database's pool: the rows of a statement. */
export const queryOf =
  (db: Db): Query =>
  async <T = Record<string, unknown>>(text: string, params?: unknown[]) =>
    (await poolOf(db).query(text, params)).rows as T[];

/** The clock of the database: one instant read before the work, so no ambient clock enters the domain and every row of the work agrees. */
async function databaseClock(db: Db): Promise<{ now: () => Date }> {
  const at = (await poolOf(db).query<{ now: Date }>("SELECT now() AS now")).rows[0]!.now;
  return { now: () => at };
}

const ids = (clientId: string) => [clientId];

/** The client file itself: the identity and contact, the dependants, the reviews. Erasing blanks them; the row stays because invoices point to it. */
function clientFile(db: Db, key: Buffer | null): PrivacyContributor {
  return {
    name: "client_file",
    async exportFor(_query, subject) {
      const [client] = await db.select().from(clients).where(eq(clients.id, subject.id));
      if (!client) return refuse("AK_CLIENT_UNKNOWN");
      const [shop] = await db.select({ name: shops.name }).from(shops).where(eq(shops.id, client.shopId));
      const pets = await db.select().from(dependants).where(eq(dependants.clientId, subject.id));
      let accessNotes: string | null = null;
      if (client.accessNotesEnc) {
        if (!key) throw new Error("AK_NO_DATA_KEY: the access notes are sealed; opening them needs the data key");
        accessNotes = openField(client.accessNotesEnc, key, subject.id);
      }
      return {
        shop: shop?.name ?? null,
        file: { fullName: client.fullName, email: client.email, phone: client.phone, language: client.language, notes: client.notes, createdAt: client.createdAt.toISOString(), accessNotes },
        dependants: pets.sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ kind: p.kind, name: p.name, profile: p.profile })),
      };
    },
    async eraseFor(tx, subject) {
      const id = ids(subject.id);
      await tx(
        "UPDATE clients SET full_name = '—', email = NULL, phone = NULL, notes = NULL, access_notes_enc = NULL, account_id = NULL, erased_at = COALESCE(erased_at, now()) WHERE id = $1",
        id,
      );
      await tx("UPDATE dependants SET name = '—', profile = '{}'::jsonb, erased_at = COALESCE(erased_at, now()) WHERE client_id = $1", id);
      // The shop's notes on the client are personal information: gone with the file.
      await tx("DELETE FROM client_notes WHERE client_id = $1", id);
      // Their review keeps its rating (the score) but loses the name, the words and the link to the file.
      await tx("UPDATE shop_reviews SET first_name = '—', last_initial = '', body = '', client_id = NULL WHERE client_id = $1", id);
    },
  };
}

/** The visits: the reports (note and photo), their private links and the mails that carried them. */
function visits(db: Db): PrivacyContributor {
  return {
    name: "visits",
    async exportFor(_query, subject) {
      const bookings = await poolOf(db).query<{ startsAt: Date; nameFr: string; nameEn: string; zone: string | null; dependant: string; status: string; reportId: string | null; note: string | null; durationMinutes: number | null; hasPhoto: boolean | null }>(
        `SELECT lower(a.during) AS "startsAt", sv.name_fr AS "nameFr", sv.name_en AS "nameEn", z.name AS zone, d.name AS dependant, b.status,
                r.id AS "reportId", r.note, r.duration_minutes AS "durationMinutes", (r.photo IS NOT NULL) AS "hasPhoto"
           FROM bookings b JOIN appointments a ON a.id = b.appointment_id JOIN services sv ON sv.id = a.service_id JOIN dependants d ON d.id = b.dependant_id
           LEFT JOIN shop_zones z ON z.id = a.zone_id LEFT JOIN visit_reports r ON r.booking_id = b.id
          WHERE b.client_id = $1 ORDER BY lower(a.during) DESC`,
        ids(subject.id),
      );
      const photos = await poolOf(db).query<{ id: string; data: string; photo_type: string }>(
        "SELECT r.id, encode(r.photo, 'base64') AS data, r.photo_type FROM visit_reports r JOIN bookings b ON b.id = r.booking_id WHERE b.client_id = $1 AND r.photo IS NOT NULL ORDER BY r.created_at, r.id",
        ids(subject.id),
      );
      return {
        bookings: bookings.rows.map((v) => ({
          startsAt: new Date(v.startsAt).toISOString(),
          service: { fr: v.nameFr, en: v.nameEn },
          zone: v.zone,
          dependant: v.dependant,
          status: v.status,
          report: v.reportId ? { note: v.note, durationMinutes: v.durationMinutes, photoId: v.hasPhoto ? v.reportId : null } : null,
        })),
        photos: photos.rows.map((p) => ({ reportId: p.id, type: p.photo_type, base64: p.data })),
      };
    },
    async eraseFor(tx, subject) {
      const id = ids(subject.id);
      await tx("DELETE FROM mail_outbox WHERE related_kind = 'visit_report' AND related_id IN (SELECT r.id FROM visit_reports r JOIN bookings b ON b.id = r.booking_id WHERE b.client_id = $1)", id);
      await tx(
        "UPDATE visit_reports SET note = '—', photo = NULL, photo_type = NULL, token_expires_at = now(), view_token_hash = encode(sha256(gen_random_uuid()::text::bytea), 'hex'), sent_at = NULL WHERE booking_id IN (SELECT id FROM bookings WHERE client_id = $1)",
        id,
      );
    },
  };
}

/** The invoices: kept for the tax period (`RETENTION_RULES`), so only the delivery links and their mails go; the person is blanked on the client file they point to. */
function invoices(): PrivacyContributor {
  return {
    name: "invoices",
    async exportFor(query, subject) {
      return query(
        "SELECT i.number, to_char(i.issued_on, 'YYYY-MM-DD') AS \"issuedOn\", i.subtotal_cents AS \"subtotalCents\", i.gst_cents AS \"gstCents\", i.qst_cents AS \"qstCents\", i.total_cents AS \"totalCents\" FROM invoices i WHERE i.client_id = $1 ORDER BY i.issued_on, i.number",
        ids(subject.id),
      );
    },
    async eraseFor(tx, subject) {
      const id = ids(subject.id);
      await tx("DELETE FROM mail_outbox WHERE related_kind = 'invoice_delivery' AND related_id IN (SELECT d.id FROM invoice_deliveries d JOIN invoices i ON i.id = d.invoice_id WHERE i.client_id = $1)", id);
      await tx("UPDATE invoice_deliveries SET revoked_at = COALESCE(revoked_at, now()), to_email = '—' WHERE invoice_id IN (SELECT id FROM invoices WHERE client_id = $1)", id);
    },
  };
}

/** The requests a client sent to a shop and the addresses of their files. The files in the media store are removed by the caller before the erasure (`eraseClientRequests` answers their addresses). */
function requests(): PrivacyContributor {
  return {
    name: "requests",
    async exportFor(query, subject) {
      const found = await query<{ id: string; title: string; note: string | null; createdAt: string }>("SELECT id, title, note, created_at AS \"createdAt\" FROM client_requests WHERE client_id = $1 ORDER BY created_at, id", ids(subject.id));
      const files = await query<{ requestId: string; url: string; kind: string }>(
        "SELECT f.request_id AS \"requestId\", f.url, f.kind FROM client_request_files f JOIN client_requests r ON r.id = f.request_id WHERE r.client_id = $1 ORDER BY f.created_at, f.id",
        ids(subject.id),
      );
      return found.map((r) => ({ ...r, files: files.filter((f) => f.requestId === r.id).map((f) => ({ url: f.url, kind: f.kind })) }));
    },
    async eraseFor(tx, subject) {
      await tx("DELETE FROM client_requests WHERE client_id = $1", ids(subject.id));
    },
  };
}

/** The consents: part of the right of access; the package withdraws the live ones at erasure and keeps the proof. */
function consents(): PrivacyContributor {
  return {
    name: "consents",
    async exportFor(query, subject) {
      return (await dbPrivacyStore(query).consentHistory(subject)).map((c) => ({ purpose: c.purpose, granted: c.granted, textVersion: c.version, at: c.at.toISOString() }));
    },
    async eraseFor() {
      // nothing to erase: a consent holds the client file's id and a purpose, no personal data; it is the proof of what was agreed
    },
  };
}

/**
 * The privacy of a client file over this database. `key` opens the sealed access notes for the export; an erasure needs none.
 */
export async function clientPrivacy(db: Db, key: Buffer | null = null): Promise<Privacy> {
  return createPrivacy({
    clock: await databaseClock(db),
    purposes: CONSENT_PURPOSES,
    contributors: [clientFile(db, key), visits(db), invoices(), requests(), consents()],
    transaction: (work) => transactionOn(poolOf(db), (run) => work(run as Query)),
  });
}

/** A consent decision (Loi 25), appended - never edited. A withdrawal is a new decision. */
export async function recordConsent(db: Db, clientId: string, purpose: ConsentPurpose, granted: boolean, textVersion: string): Promise<void> {
  await (await clientPrivacy(db)).recordConsent(queryOf(db), { subject: clientSubject(clientId), purpose, version: textVersion, granted });
}

/** Every decision of a client, oldest first, as `consentsInForce` reads them. */
export async function consentHistoryOf(db: Db, clientId: string): Promise<Array<{ purpose: ConsentPurpose; granted: boolean; textVersion: string; at: Date }>> {
  const history = await dbPrivacyStore(queryOf(db)).consentHistory(clientSubject(clientId));
  return history.map((c) => ({ purpose: c.purpose as ConsentPurpose, granted: c.granted, textVersion: c.version, at: c.at }));
}

/**
 * Erases a client's personal information (Loi 25), in one transaction through every contributor: the file, the dependants, the notes,
 * the reviews' name, the reports' notes and photos and their mails, the invoices' delivery links; every live consent withdrawn. The
 * row stays because the invoices that name it are kept six years (tax law). Returns false if already erased.
 */
export async function eraseClient(db: Db, clientId: string, textVersion: string): Promise<boolean> {
  const [row] = (await poolOf(db).query<{ erased: boolean }>("SELECT erased_at IS NOT NULL AS erased FROM clients WHERE id = $1", [clientId])).rows;
  if (!row || row.erased) return false;
  await (await clientPrivacy(db)).eraseSubject(clientSubject(clientId), { noticeVersion: textVersion });
  return true;
}

/** Everything held about a client, in one document - their right of access (Loi 25). Access notes are opened for them. */
export async function exportClient(db: Db, key: Buffer, clientId: string) {
  const [client] = await db.select({ erasedAt: clients.erasedAt }).from(clients).where(eq(clients.id, clientId));
  if (!client || client.erasedAt) return refuse("AK_CLIENT_UNKNOWN");
  return (await clientPrivacy(db, key)).exportSubject(queryOf(db), clientSubject(clientId));
}
