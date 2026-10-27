import { and, asc, eq, inArray, isNull, type SQL, sql } from "drizzle-orm";

import type { Db } from "./client";
import { appointments, bookings, clients, feedTokens, services, shops, staff } from "./schema";

/** A feed: the whole shop's (`staffId` null) or one staff member's. */
export interface FeedRef {
  shopId: string;
  staffId: string | null;
}

export interface FeedInfo extends FeedRef {
  id: string;
  createdAt: Date;
  rotatedAt: Date | null;
}

/** The staff member must belong to the shop: another shop's staff id is "no such feed", the answer of an id that exists nowhere. */
async function ownStaff(db: Pick<Db, "select">, ref: FeedRef): Promise<boolean> {
  if (ref.staffId === null) return true;
  const [row] = await db.select({ id: staff.id }).from(staff).where(and(eq(staff.id, ref.staffId), eq(staff.shopId, ref.shopId)));
  return row !== undefined;
}

/**
 * Gives the feed a new token (its first, or a rotation): the previous one is revoked in the same transaction, so the old address is dead the moment the new
 * one exists. Only the keyed hash is stored. `null` when the staff member is not the shop's.
 */
export async function rotateFeedToken(db: Db, ref: FeedRef, tokenHash: string, now: Date): Promise<FeedInfo | null> {
  if (!(await ownStaff(db, ref))) return null;
  return db.transaction(async (tx) => {
    // Two rotations of the same feed take turns: the second revokes the first's token, never leaving two live ones.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`feed:${ref.shopId}:${ref.staffId ?? ""}`}, 0))`);
    const live = ref.staffId === null ? isNull(feedTokens.staffId) : eq(feedTokens.staffId, ref.staffId);
    const revoked = await tx.update(feedTokens).set({ revokedAt: now }).where(and(eq(feedTokens.shopId, ref.shopId), live, isNull(feedTokens.revokedAt))).returning({ id: feedTokens.id });
    const [row] = await tx.insert(feedTokens).values({ shopId: ref.shopId, staffId: ref.staffId, tokenHash, rotatedAt: revoked.length > 0 ? now : null }).returning();
    return { id: row!.id, shopId: row!.shopId, staffId: row!.staffId, createdAt: row!.createdAt, rotatedAt: row!.rotatedAt };
  });
}

/** Switches the feed off: its address answers 404 from now on. `false` when there was no live token (or the staff member is not the shop's). */
export async function revokeFeedToken(db: Db, ref: FeedRef, now: Date): Promise<boolean> {
  if (!(await ownStaff(db, ref))) return false;
  const live = ref.staffId === null ? isNull(feedTokens.staffId) : eq(feedTokens.staffId, ref.staffId);
  const revoked = await db.update(feedTokens).set({ revokedAt: now }).where(and(eq(feedTokens.shopId, ref.shopId), live, isNull(feedTokens.revokedAt))).returning({ id: feedTokens.id });
  return revoked.length > 0;
}

/** The live feeds of a shop (never a token: it is not kept). */
export async function liveFeeds(db: Db, shopId: string): Promise<FeedInfo[]> {
  return db.select({ id: feedTokens.id, shopId: feedTokens.shopId, staffId: feedTokens.staffId, createdAt: feedTokens.createdAt, rotatedAt: feedTokens.rotatedAt }).from(feedTokens).where(and(eq(feedTokens.shopId, shopId), isNull(feedTokens.revokedAt)));
}

/** The feed a token's keyed hash opens, if it is live. An unknown, rotated or revoked token is `null`: the same answer, so nothing tells which. */
export async function feedByTokenHash(db: Db, tokenHash: string): Promise<FeedRef | null> {
  const [row] = await db.select({ shopId: feedTokens.shopId, staffId: feedTokens.staffId }).from(feedTokens).where(and(eq(feedTokens.tokenHash, tokenHash), isNull(feedTokens.revokedAt)));
  return row ?? null;
}

/** What the feed says of one appointment: when, which service, and the first names of who booked it. Never a surname, a phone, an e-mail, a note or an address. */
export interface FeedEntry {
  appointmentId: string;
  startsAt: Date;
  endsAt: Date;
  status: "booked" | "done" | "noShow";
  service: { fr: string; en: string };
  firstNames: string[];
}

const firstNameOf = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? "";

/** The appointments of a feed between two instants (cancelled ones left out), the shop's or the staff member's own. */
export async function feedEntries(db: Db, feed: FeedRef, from: Date, to: Date): Promise<FeedEntry[]> {
  return entriesBetween(db, feed, sql`${from.toISOString()}::timestamptz`, sql`${to.toISOString()}::timestamptz`);
}

/** The same around an instant: `behindDays` before it and `aheadDays` after, counted in calendar days by the database. */
export async function feedEntriesAround(db: Db, feed: FeedRef, now: Date, behindDays: number, aheadDays: number): Promise<FeedEntry[]> {
  const at = sql`${now.toISOString()}::timestamptz`;
  return entriesBetween(db, feed, sql`${at} - make_interval(days => ${behindDays})`, sql`${at} + make_interval(days => ${aheadDays})`);
}

async function entriesBetween(db: Db, feed: FeedRef, from: SQL, to: SQL): Promise<FeedEntry[]> {
  const rows = await db
    .select({ id: appointments.id, status: appointments.status, nameFr: services.nameFr, nameEn: services.nameEn, start: sql<string>`lower(${appointments.during})`, end: sql<string>`upper(${appointments.during})` })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .where(and(eq(appointments.shopId, feed.shopId), feed.staffId === null ? undefined : eq(appointments.staffId, feed.staffId), sql`${appointments.status} <> 'cancelled'`, sql`${appointments.during} && tstzrange(${from}, ${to})`))
    .orderBy(sql`lower(${appointments.during})`);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  // Who is on an appointment: the client it was made for, and those who booked a seat (a walk has several dogs, a class several people).
  const direct = await db
    .select({ appointmentId: appointments.id, fullName: clients.fullName, erasedAt: clients.erasedAt })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .where(inArray(appointments.id, ids));
  const seats = await db
    .select({ appointmentId: bookings.appointmentId, fullName: clients.fullName, erasedAt: clients.erasedAt })
    .from(bookings)
    .innerJoin(clients, eq(clients.id, bookings.clientId))
    .where(and(inArray(bookings.appointmentId, ids), eq(bookings.status, "booked")))
    .orderBy(asc(bookings.createdAt));
  const who = [...direct, ...seats];
  return rows.map((r) => ({
    appointmentId: r.id,
    startsAt: new Date(r.start),
    endsAt: new Date(r.end),
    status: r.status as FeedEntry["status"],
    service: { fr: r.nameFr, en: r.nameEn },
    firstNames: [...new Set(who.filter((w) => w.appointmentId === r.id && w.erasedAt === null).map((w) => firstNameOf(w.fullName)).filter(Boolean))],
  }));
}

/** The feed's title in a calendar app: « Akinaza · Salon Laurier » or « Akinaza · Salon Laurier · Julie ». */
export async function feedTitle(db: Db, feed: FeedRef): Promise<string> {
  const [shop] = await db.select({ name: shops.name }).from(shops).where(eq(shops.id, feed.shopId));
  const [person] = feed.staffId ? await db.select({ name: staff.name }).from(staff).where(and(eq(staff.id, feed.staffId), eq(staff.shopId, feed.shopId))) : [];
  return ["Akinaza", shop?.name, person?.name].filter(Boolean).join(" · ");
}

/** The people a member may open a feed for: every active staff member for who runs the shop's bookings, only their own row otherwise. */
export async function feedPeople(db: Db, shopId: string, own: { staffAccountId?: string }): Promise<{ id: string; name: string }[]> {
  const rows = await db.select({ id: staff.id, name: staff.name }).from(staff).where(and(eq(staff.shopId, shopId), eq(staff.active, true), own.staffAccountId ? eq(staff.accountId, own.staffAccountId) : undefined)).orderBy(asc(staff.name));
  return rows;
}
