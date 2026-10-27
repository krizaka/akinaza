import { type BusyInterval, type BusyRange, type CalendarKind, mergeBusy, nextSyncDelayMinutes, type Validators } from "@akinaza/core";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";

import type { Db, Tx } from "./client";
import { busyIntervals, calendarConnections, staff } from "./schema";
import { ShopError } from "./errors";

/** The calendar sources of a shop (ADR-004, #282): connections, their sync bookkeeping and the busy times they gave. */
type Reader = Db | Tx;

export interface ConnectionInfo {
  id: string;
  staffId: string | null;
  kind: CalendarKind;
  label: string;
  state: "pending" | "ok" | "error";
  lastError: string | null;
  lastSuccessAt: Date | null;
  consentedAt: Date;
}

export interface NewConnection {
  /** Made by the caller: the sealed secret uses it as its additional data, so it must exist before the row. */
  id: string;
  shopId: string;
  staffId: string | null;
  kind: CalendarKind;
  label: string;
  secretEnc: string;
  consentTextVersion: string;
  now: Date;
  /** The administrator's bound on connections per shop. */
  max: number;
}

const refuse = (code: string): never => {
  throw new ShopError(code);
};

/** Connects a calendar: the staff member must be the shop's, the shop under its bound. Syncs as soon as the next tick comes. */
export async function addConnection(db: Db, input: NewConnection): Promise<ConnectionInfo> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`calendar:${input.shopId}`}, 0))`);
    if (input.staffId) {
      const [own] = await tx.select({ id: staff.id }).from(staff).where(and(eq(staff.id, input.staffId), eq(staff.shopId, input.shopId)));
      if (!own) return refuse("AK_STAFF_UNKNOWN");
    }
    const [{ n }] = (await tx.select({ n: sql<number>`count(*)::int` }).from(calendarConnections).where(eq(calendarConnections.shopId, input.shopId))) as [{ n: number }];
    if (n >= input.max) return refuse("AK_CALENDAR_LIMIT");
    const [row] = await tx
      .insert(calendarConnections)
      .values({ id: input.id, shopId: input.shopId, staffId: input.staffId, kind: input.kind, label: input.label, secretEnc: input.secretEnc, consentTextVersion: input.consentTextVersion, consentedAt: input.now, nextSyncAt: input.now })
      .returning();
    return info(row!);
  });
}

const info = (r: typeof calendarConnections.$inferSelect): ConnectionInfo => ({ id: r.id, staffId: r.staffId, kind: r.kind, label: r.label, state: r.state, lastError: r.lastError, lastSuccessAt: r.lastSuccessAt, consentedAt: r.consentedAt });

/** The connections a member may see: the shop's, or only their own staff row's (never the secret). */
export async function listConnections(db: Reader, shopId: string, own: { staffAccountId?: string } = {}): Promise<ConnectionInfo[]> {
  const rows = await db
    .select()
    .from(calendarConnections)
    .where(and(eq(calendarConnections.shopId, shopId), own.staffAccountId ? sql`${calendarConnections.staffId} IN (SELECT ${staff.id} FROM ${staff} WHERE ${staff.accountId} = ${own.staffAccountId})` : undefined))
    .orderBy(asc(calendarConnections.createdAt));
  return rows.map(info);
}

/** Disconnects: the connection and the busy times it gave are deleted together (the cascade), so the slots are free again at once. */
export async function removeConnection(db: Db, shopId: string, id: string): Promise<boolean> {
  const gone = await db.delete(calendarConnections).where(and(eq(calendarConnections.id, id), eq(calendarConnections.shopId, shopId))).returning({ id: calendarConnections.id });
  return gone.length > 0;
}

export interface DueConnection {
  id: string;
  shopId: string;
  staffId: string | null;
  kind: CalendarKind;
  secretEnc: string;
  validators: Validators;
  failures: number;
  /** The shop's zone: the floating and all-day times of a calendar are read in it. */
  timezone: string;
  /** The last good read is older than the file's validators can vouch for (the window has moved since): read it whole. */
  stale: boolean;
}

// @fixed: past this age (hours) a « not modified » answer proves nothing about the days that came into the window since
const REVALIDATE_AFTER_HOURS = 12;

/**
 * Takes the connections whose time has come, and pushes their next try a lease away so several instances (or a slow sync) never read the same one twice.
 * `only` takes one connection now (« refresh »), when it belongs to the shop.
 */
export async function claimDueConnections(db: Db, now: Date, limit: number, leaseMinutes: number, only?: { shopId: string; id: string }): Promise<DueConnection[]> {
  const rows = await db.execute(sql`
    UPDATE calendar_connections SET next_sync_at = ${now.toISOString()}::timestamptz + make_interval(mins => ${leaseMinutes}), last_attempt_at = ${now.toISOString()}::timestamptz
     WHERE id IN (
       SELECT id FROM calendar_connections
        WHERE ${only ? sql`id = ${only.id} AND shop_id = ${only.shopId}` : sql`next_sync_at <= ${now.toISOString()}::timestamptz`}
        ORDER BY next_sync_at LIMIT ${limit} FOR UPDATE SKIP LOCKED)
    RETURNING id, shop_id, staff_id, kind, secret_enc, etag, last_modified, failures,
      (last_success_at IS NULL OR last_success_at < ${now.toISOString()}::timestamptz - make_interval(hours => ${REVALIDATE_AFTER_HOURS})) AS stale,
      (SELECT s.timezone FROM shops s WHERE s.id = calendar_connections.shop_id) AS timezone`);
  return (rows.rows as { id: string; shop_id: string; staff_id: string | null; kind: CalendarKind; secret_enc: string; etag: string | null; last_modified: string | null; failures: number; stale: boolean; timezone: string }[]).map((r) => ({
    id: r.id,
    shopId: r.shop_id,
    staffId: r.staff_id,
    kind: r.kind,
    secretEnc: r.secret_enc,
    validators: { etag: r.etag, lastModified: r.last_modified },
    failures: r.failures,
    timezone: r.timezone,
    stale: r.stale,
  }));
}

const range = (i: BusyInterval) => `[${i.startsAt.toISOString()},${i.endsAt.toISOString()})`;

/** A good read: the busy times replace the old ones (when the source changed), the validators are kept, the failures forgotten. */
export async function recordSyncOk(db: Db, c: Pick<DueConnection, "id" | "shopId" | "staffId">, result: { busy: BusyInterval[]; validators: Validators } | null, now: Date, intervalMinutes: number): Promise<void> {
  await db.transaction(async (tx) => {
    if (result) {
      await tx.delete(busyIntervals).where(eq(busyIntervals.connectionId, c.id));
      const merged = mergeBusy(result.busy);
      if (merged.length > 0) await tx.insert(busyIntervals).values(merged.map((i) => ({ connectionId: c.id, shopId: c.shopId, staffId: c.staffId, during: range(i) })));
    }
    await tx
      .update(calendarConnections)
      .set({ state: "ok", failures: 0, lastError: null, lastSuccessAt: now, nextSyncAt: sql`${now.toISOString()}::timestamptz + make_interval(mins => ${intervalMinutes})`, ...(result ? { etag: result.validators.etag, lastModified: result.validators.lastModified } : {}) })
      .where(eq(calendarConnections.id, c.id));
  });
}

/** A failed read: the state says so, the next try backs off. The busy times of the last good read stay (an outage frees no slot by itself). */
export async function recordSyncFailure(db: Db, c: Pick<DueConnection, "id" | "failures">, code: string, now: Date, intervalMinutes: number): Promise<void> {
  const failures = c.failures + 1;
  await db.update(calendarConnections).set({ state: "error", failures, lastError: code, nextSyncAt: sql`${now.toISOString()}::timestamptz + make_interval(mins => ${nextSyncDelayMinutes(intervalMinutes, failures)})` }).where(eq(calendarConnections.id, c.id));
}

/** The busy times that matter for a person's slots: the shop-wide connections' and that person's own. */
export async function busyBetween(db: Reader, shopId: string, staffId: string, window: BusyRange): Promise<BusyInterval[]> {
  const rows = await db
    .select({ start: sql<string>`lower(${busyIntervals.during})`, end: sql<string>`upper(${busyIntervals.during})` })
    .from(busyIntervals)
    .where(and(eq(busyIntervals.shopId, shopId), or(isNull(busyIntervals.staffId), eq(busyIntervals.staffId, staffId)), sql`${busyIntervals.during} && tstzrange(${window.from.toISOString()}::timestamptz, ${window.to.toISOString()}::timestamptz)`));
  return rows.map((r) => ({ startsAt: new Date(r.start), endsAt: new Date(r.end) }));
}

/** Which of these appointments overlap the owner's other calendars, and the label of the calendar: Akinaza flags it, it never deletes either side. */
export async function agendaConflicts(db: Reader, appointmentIds: readonly string[]): Promise<Map<string, string>> {
  if (appointmentIds.length === 0) return new Map();
  const rows = await db.execute(sql`
    SELECT DISTINCT ON (a.id) a.id, c.label
      FROM appointments a
      JOIN busy_intervals b ON b.shop_id = a.shop_id AND (b.staff_id IS NULL OR b.staff_id = a.staff_id) AND b.during && a.during
      JOIN calendar_connections c ON c.id = b.connection_id
     WHERE a.id IN (${sql.join(appointmentIds.map((id) => sql`${id}::uuid`), sql`, `)}) AND a.status <> 'cancelled'
     ORDER BY a.id, c.created_at`);
  return new Map((rows.rows as { id: string; label: string }[]).map((r) => [r.id, r.label]));
}
