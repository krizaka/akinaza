import { addLocalDays, businessTypeSchema, type MemberDay, timeOffDays, type TimeOffRange, timeOffRanges, canCancel, type DependantInput, dependantInputSchema, localDay, openSlots, popularServiceId, type ShopRules, shopRulesSchema, type Slot, slugSchema, type TakenVisit, vocabularyOf, type WeeklyWindow } from "@akinaza/core";
import { addDays, compareAsc } from "date-fns";
import { and, asc, between, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db, Tx } from "./client";
import { openField, sealField } from "./crypto";
import { busyBetween } from "./calendar-connections";
import { ShopError } from "./errors";
import { type CommunityView, communityOf } from "./shop-community";
import { shopPageConfigOf, type ShopPageConfig } from "./shop-page";
import { type ShopLanguages, shopLanguagesOf, type StoredTranslation, translationsOf } from "./shop-translations";
import { appointments, bookings, memberships, clients, dependants, daysOff, MediaRole, schedules, services, shopFormerSlugs, shopMedia, shopRules, shops, shopZones, staff } from "./schema";
import { recordConsent } from "./shop-ops";

/**
 * The service-shop operations (ADR-001): a shop page with its zones, services, weekly hours and rules; the public read of
 * it; the offered slots; a client joining a shop, adding a dependant, booking and cancelling. Every function takes the
 * clock as a parameter; every rule that matters is also kept by the database (capacity, no double booking, ownership).
 */

/** The version of the consent texts shown when a client joins a shop (Loi 25: a decision is tied to the words seen). */
export const CONSENT_TEXT_VERSION = "2026-10-17";

export { ShopError };

const refuse = (code: string): never => {
  throw new ShopError(code);
};

const text = (max: number) => z.string().trim().min(1).max(max);

export const shopPageSchema = z.object({
  name: text(80),
  legalName: text(120),
  address: text(200),
  slug: slugSchema,
  taglineFr: z.string().trim().max(160).default(""),
  taglineEn: z.string().trim().max(160).default(""),
  published: z.boolean().default(false),
  /** The name shown for the person who works (the shop's first staff member). */
  ownerName: text(80),
  /** The storefront's words: the locality, the owner's bio and how to reach the shop. Omitted = left as they are. */
  area: z.string().trim().max(80).optional(),
  bioFr: z.string().trim().max(600).optional(),
  bioEn: z.string().trim().max(600).optional(),
  publicPhone: z.string().trim().max(40).optional(),
  publicEmail: z.string().trim().max(120).optional(),
  publicWebsite: z.string().trim().max(200).optional(),
  /** The kind of business: it sets the words of the screens and whether a booking is made for a dog (krizaka/akinaza#117). Omitted = left as it is. */
  businessType: businessTypeSchema.optional(),
  /** What a seat of a group service is called (« chiens »): « Up to 5 dogs ». */
  seatUnitFr: z.string().trim().max(30).optional(),
  seatUnitEn: z.string().trim().max(30).optional(),
});
export type ShopPageInput = z.input<typeof shopPageSchema>;

export const serviceInputSchema = z.object({
  id: z.string().uuid().optional(),
  nameFr: text(80),
  nameEn: text(80),
  durationMinutes: z.number().int().min(5).max(600),
  priceCents: z.number().int().min(0).max(1_000_000),
  capacity: z.number().int().min(1).max(50),
  active: z.boolean().default(true),
  /** The card on the public page: a sentence, short inclusions, « from » when the price varies. Omitted = left as they are. */
  descriptionFr: z.string().trim().max(300).optional(),
  descriptionEn: z.string().trim().max(300).optional(),
  includedFr: z.array(text(80)).max(6).optional(),
  includedEn: z.array(text(80)).max(6).optional(),
  priceVaries: z.boolean().optional(),
});
export type ServiceInput = z.input<typeof serviceInputSchema>;

export const windowInputSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

const isUniqueViolation = (error: unknown, constraint: string) => {
  const e = error as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  return (e.code ?? e.cause?.code) === "23505" && (e.constraint ?? e.cause?.constraint) === constraint;
};

/** Whether a database refusal carries one of our `AK_…` codes (the trigger and constraint messages), and which. */
export function akCode(error: unknown): string | null {
  const e = error as { message?: string; cause?: { message?: string } };
  return /AK_[A-Z_]+/.exec(`${e.message ?? ""} ${e.cause?.message ?? ""}`)?.[0] ?? null;
}

/** The shop of an owner: the one asked for (it must be theirs), else the default one. Null when there is none. */
export async function shopOfOwner(db: Db, ownerId: string, shopId?: string) {
  const [shop] = await db.select().from(shops).where(shopId ? and(eq(shops.ownerId, ownerId), eq(shops.id, shopId)) : eq(shops.ownerId, ownerId)).orderBy(desc(shops.isDefault), asc(shops.createdAt)).limit(1);
  return shop ?? null;
}

/**
 * The shop an account works in, with its role there: the one asked for (they must be a member), else the one they own and opened last
 * (the default), else the first they were invited to. Null when they belong to none.
 */
export async function shopOfMember(db: Db, accountId: string, shopId?: string) {
  const [row] = await db
    .select({ shop: shops, role: sql<"owner" | "manager" | "staff">`${memberships.role}` })
    .from(memberships)
    .innerJoin(shops, eq(shops.id, memberships.scopeId))
    .where(shopId ? and(eq(memberships.accountId, accountId), eq(shops.id, shopId)) : eq(memberships.accountId, accountId))
    .orderBy(sql`(${memberships.role} = 'owner' AND ${shops.isDefault}) DESC`, sql`(${memberships.role} = 'owner') DESC`, asc(shops.createdAt))
    .limit(1);
  return row ?? null;
}

/** Every shop an account works in, with its role there: the switcher's list (the default shop first). */
export async function shopsOfMember(db: Db, accountId: string) {
  return db
    .select({ id: shops.id, name: shops.name, role: sql<"owner" | "manager" | "staff">`${memberships.role}` })
    .from(memberships)
    .innerJoin(shops, eq(shops.id, memberships.scopeId))
    .where(eq(memberships.accountId, accountId))
    .orderBy(sql`(${memberships.role} = 'owner' AND ${shops.isDefault}) DESC`, sql`(${memberships.role} = 'owner') DESC`, asc(shops.name));
}

/** The account that runs a shop (null once the account is gone): who its webhooks and keys belong to. */
export async function ownerOfShop(db: Db, shopId: string): Promise<string | null> {
  const [row] = await db.select({ ownerId: shops.ownerId }).from(shops).where(eq(shops.id, shopId));
  return row?.ownerId ?? null;
}

/** All the owner's shops, the default first. */
export async function shopsOfOwner(db: Db, ownerId: string) {
  return db.select({ id: shops.id, name: shops.name, slug: shops.slug, published: shops.published, isDefault: shops.isDefault, businessType: shops.businessType, description: shops.description, avatar: shops.avatar, collectionId: shops.collectionId }).from(shops).where(eq(shops.ownerId, ownerId)).orderBy(desc(shops.isDefault), asc(shops.createdAt));
}

/** Makes another of the owner's shops the one the app opens on (one statement: there is always exactly one). */
export async function setDefaultShop(db: Db, ownerId: string, shopId: string): Promise<void> {
  const own = await shopOfOwner(db, ownerId, shopId);
  if (!own) refuse("AK_SHOP_UNKNOWN");
  await db.update(shops).set({ isDefault: sql`(${shops.id} = ${shopId})` }).where(eq(shops.ownerId, ownerId));
}

/** Creates the owner's shop page (with its first staff member and default rules) or updates it: the default shop, or `shopId`; `additional` adds another shop. A first shop becomes the default. Publishing needs an active service. */
export async function saveShopPage(db: Db, ownerId: string, raw: ShopPageInput, which: { shopId?: string; additional?: false } | { additional: true; /** The most shops the owner may run (the administrator's `limits.shopsPerOwner`): checked here, under a lock, so no route can skip it and two requests cannot both pass. */ maxShops: number } = {}): Promise<{ shopId: string; created: boolean }> {
  const input = shopPageSchema.parse(raw);
  try {
    return await db.transaction(async (tx) => {
      if (which.additional) {
        // One owner, one line at a time: the count and the insert are one decision (a second request waits here until the first has committed).
        await tx.execute(sql`SELECT id FROM accounts WHERE id = ${ownerId} FOR UPDATE`);
        const [owned] = await tx.select({ n: sql<number>`count(*)::int` }).from(shops).where(eq(shops.ownerId, ownerId));
        if (owned!.n >= which.maxShops) refuse("AK_SHOP_LIMIT");
      }
      const askedId = which.additional ? undefined : which.shopId;
      const [existing] = which.additional ? [] : await tx.select().from(shops).where(askedId ? and(eq(shops.ownerId, ownerId), eq(shops.id, askedId)) : eq(shops.ownerId, ownerId)).orderBy(desc(shops.isDefault), asc(shops.createdAt)).limit(1).for("update");
      if (askedId && !existing) refuse("AK_SHOP_UNKNOWN");
      if (input.published) {
        const count = existing ? (await tx.select({ n: sql<number>`count(*)::int` }).from(services).where(and(eq(services.shopId, existing.id), eq(services.active, true))))[0]!.n : 0;
        if (count === 0) refuse("AK_NOT_PUBLISHABLE");
      }
      const values = {
        name: input.name,
        legalName: input.legalName,
        address: input.address,
        slug: input.slug,
        taglineFr: input.taglineFr || null,
        taglineEn: input.taglineEn || null,
        published: input.published,
        ...(input.businessType === undefined ? {} : { businessType: input.businessType }),
        ...(input.area === undefined ? {} : { area: input.area || null }),
        ...(input.bioFr === undefined ? {} : { bioFr: input.bioFr || null }),
        ...(input.bioEn === undefined ? {} : { bioEn: input.bioEn || null }),
        ...(input.publicPhone === undefined ? {} : { publicPhone: input.publicPhone || null }),
        ...(input.publicEmail === undefined ? {} : { publicEmail: input.publicEmail || null }),
        ...(input.publicWebsite === undefined ? {} : { publicWebsite: input.publicWebsite || null }),
        ...(input.seatUnitFr === undefined ? {} : { seatUnitFr: input.seatUnitFr || null }),
        ...(input.seatUnitEn === undefined ? {} : { seatUnitEn: input.seatUnitEn || null }),
      };
      if (existing) {
        await tx.update(shops).set(values).where(eq(shops.id, existing.id));
        const owner = await ownStaff(tx, existing.id);
        await tx.update(staff).set({ name: input.ownerName }).where(eq(staff.id, owner.id));
        return { shopId: existing.id, created: false };
      }
      const [shop] = await tx.insert(shops).values({ ...values, ownerId, kind: "services", registrant: false, timezone: "America/Toronto" }).returning({ id: shops.id });
      await tx.insert(staff).values({ shopId: shop!.id, name: input.ownerName });
      await tx.insert(shopRules).values({ shopId: shop!.id });
      return { shopId: shop!.id, created: true };
    });
  } catch (error) {
    if (isUniqueViolation(error, "shops_slug")) throw new ShopError("AK_SLUG_TAKEN");
    throw error;
  }
}

/** An area of the map: where it is centred (WGS 84). */
export const zonePlaceSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

export async function addZone(db: Db, shopId: string, name: string, place?: z.input<typeof zonePlaceSchema>): Promise<string> {
  const [position] = await db.select({ n: sql<number>`coalesce(max(${shopZones.position}), 0) + 1` }).from(shopZones).where(eq(shopZones.shopId, shopId));
  const at = place ? zonePlaceSchema.parse(place) : null;
  try {
    const [row] = await db.insert(shopZones).values({ shopId, name: text(80).parse(name), position: position?.n ?? 1, lat: at?.lat ?? null, lng: at?.lng ?? null }).returning({ id: shopZones.id });
    return row!.id;
  } catch (error) {
    if (isUniqueViolation(error, "shop_zones_name_per_shop")) throw new ShopError("AK_ZONE_EXISTS");
    throw error;
  }
}

/** A zone leaves the offer (visits that happened keep pointing to it). */
export async function archiveZone(db: Db, shopId: string, zoneId: string): Promise<void> {
  await db.update(shopZones).set({ active: false }).where(and(eq(shopZones.id, zoneId), eq(shopZones.shopId, shopId)));
}

export async function saveService(db: Db, shopId: string, raw: ServiceInput): Promise<string> {
  const input = serviceInputSchema.parse(raw);
  const values = {
    nameFr: input.nameFr,
    nameEn: input.nameEn,
    durationMinutes: input.durationMinutes,
    priceCents: input.priceCents,
    capacity: input.capacity,
    active: input.active,
    ...(input.descriptionFr === undefined ? {} : { descriptionFr: input.descriptionFr || null }),
    ...(input.descriptionEn === undefined ? {} : { descriptionEn: input.descriptionEn || null }),
    ...(input.includedFr === undefined ? {} : { includedFr: input.includedFr }),
    ...(input.includedEn === undefined ? {} : { includedEn: input.includedEn }),
    ...(input.priceVaries === undefined ? {} : { priceVaries: input.priceVaries }),
  };
  if (input.id) {
    const [row] = await db.update(services).set(values).where(and(eq(services.id, input.id), eq(services.shopId, shopId))).returning({ id: services.id });
    return row?.id ?? refuse("AK_SERVICE_UNKNOWN");
  }
  const [row] = await db.insert(services).values({ shopId, ...values }).returning({ id: services.id });
  return row!.id;
}

async function ownStaff(tx: Db | Tx, shopId: string) {
  const [member] = await tx.select().from(staff).where(and(eq(staff.shopId, shopId), eq(staff.active, true))).orderBy(asc(staff.createdAt), asc(staff.id)).limit(1);
  return member ?? refuse("AK_STAFF_UNKNOWN");
}

/** Everyone who works at the shop, the owner first, then in the order they joined. */
async function activeStaff(tx: Db | Tx, shopId: string) {
  return tx.select().from(staff).where(and(eq(staff.shopId, shopId), eq(staff.active, true))).orderBy(asc(staff.createdAt), asc(staff.id));
}

/** A member of this shop (the owner when none is named). */
async function staffFor(tx: Db | Tx, shopId: string, staffId?: string | null) {
  if (!staffId) return ownStaff(tx, shopId);
  const [member] = await tx.select().from(staff).where(and(eq(staff.id, staffId), eq(staff.shopId, shopId), eq(staff.active, true)));
  return member ?? refuse("AK_STAFF_UNKNOWN");
}

/** Adds a person who works at the shop (a stylist, an artist): their own weekly hours and days off come next. */
export async function addStaff(db: Db, shopId: string, name: string): Promise<string> {
  const first = text(60).parse(name);
  const [shop] = await db.select({ id: shops.id }).from(shops).where(eq(shops.id, shopId));
  if (!shop) return refuse("AK_SHOP_UNKNOWN");
  const [row] = await db.insert(staff).values({ shopId, name: first }).returning({ id: staff.id });
  return row!.id;
}

const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));

/** Adds a weekly window of the shop's worker; two windows of one weekday never overlap. */
export async function addWindow(db: Db, shopId: string, raw: z.input<typeof windowInputSchema>, staffId?: string): Promise<string> {
  const input = windowInputSchema.parse(raw);
  if (minutes(input.endsAt) <= minutes(input.startsAt)) refuse("AK_WINDOW_ORDER");
  const member = await staffFor(db, shopId, staffId);
  const same = await db.select().from(schedules).where(and(eq(schedules.staffId, member.id), eq(schedules.weekday, input.weekday)));
  if (same.some((w) => minutes(input.startsAt) < minutes(w.endsAt) && minutes(w.startsAt) < minutes(input.endsAt))) refuse("AK_WINDOW_OVERLAP");
  const [row] = await db.insert(schedules).values({ staffId: member.id, weekday: input.weekday, startsAt: input.startsAt, endsAt: input.endsAt }).returning({ id: schedules.id });
  return row!.id;
}

export async function removeWindow(db: Db, shopId: string, windowId: string): Promise<void> {
  const member = await ownStaff(db, shopId);
  await db.delete(schedules).where(and(eq(schedules.id, windowId), eq(schedules.staffId, member.id)));
}

export async function addDayOff(db: Db, shopId: string, day: string, reason?: string, staffId?: string): Promise<void> {
  const member = await staffFor(db, shopId, staffId);
  await db.insert(daysOff).values({ staffId: member.id, onDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(day), reason: reason?.trim().slice(0, 120) || null }).onConflictDoNothing();
}

export async function removeDayOff(db: Db, shopId: string, day: string): Promise<void> {
  const member = await ownStaff(db, shopId);
  await db.delete(daysOff).where(and(eq(daysOff.staffId, member.id), eq(daysOff.onDate, day)));
}

/** The people who work at the shop (with or without a sign-in), in the order they joined: whom time off can be set for. */
export async function shopStaff(db: Db, shopId: string): Promise<{ id: string; name: string }[]> {
  return (await activeStaff(db, shopId)).map((m) => ({ id: m.id, name: m.name }));
}

/** The days of a range, refused in the shop's own codes (a reversed, malformed or too long range). */
function daysOfRange(range: TimeOffRange): string[] {
  try {
    return timeOffDays(range);
  } catch (error) {
    return refuse(error instanceof RangeError ? error.message : "AK_TIME_OFF_DATE");
  }
}

/**
 * Time off for any member of the team, as a date range (akinaza#208). Stored as days, so the slots, the opening status and
 * the brief keep reading `days_off`; a range that overlaps another simply joins it (one row per staff and day).
 */
export async function addTimeOff(db: Db, shopId: string, staffId: string, range: TimeOffRange, reason?: string): Promise<void> {
  const member = await staffFor(db, shopId, staffId);
  const note = reason?.trim().slice(0, 120) || null;
  await db.insert(daysOff).values(daysOfRange(range).map((onDate) => ({ staffId: member.id, onDate, reason: note }))).onConflictDoNothing();
}

/** Removes a member's time off over a range (a whole holiday, or the days of it that changed). */
export async function removeTimeOff(db: Db, shopId: string, staffId: string, range: TimeOffRange): Promise<void> {
  const member = await staffFor(db, shopId, staffId);
  daysOfRange(range);
  await db.delete(daysOff).where(and(eq(daysOff.staffId, member.id), between(daysOff.onDate, range.from, range.to)));
}

export interface TeamTimeOff {
  staffId: string;
  name: string;
  from: string;
  to: string;
  /** Private: the team sees it, never a client nor the public page. */
  reason: string | null;
}

/** The team's time off from a day on, as ranges per person, in date order. */
export async function teamTimeOff(db: Db, shopId: string, fromDay: string): Promise<TeamTimeOff[]> {
  const rows = await db
    .select({ staffId: staff.id, name: staff.name, onDate: daysOff.onDate, reason: daysOff.reason })
    .from(daysOff)
    .innerJoin(staff, eq(staff.id, daysOff.staffId))
    .where(and(eq(staff.shopId, shopId), eq(staff.active, true), gte(daysOff.onDate, fromDay)))
    .orderBy(asc(daysOff.onDate));
  const byStaff = new Map<string, typeof rows>();
  for (const row of rows) byStaff.set(row.staffId, [...(byStaff.get(row.staffId) ?? []), row]);
  return [...byStaff.values()]
    .flatMap((days) => timeOffRanges(days.map((d) => d.onDate)).map((range) => ({ staffId: days[0]!.staffId, name: days[0]!.name, ...range, reason: days.find((d) => d.onDate === range.from)?.reason ?? null })))
    .sort((a, b) => a.from.localeCompare(b.from) || a.name.localeCompare(b.name));
}

/** Who is off on a day, with the last day of their time off (for Today: « en congé jusqu'au 27 »). */
export async function offOn(db: Db, shopId: string, day: string): Promise<{ staffId: string; name: string; until: string }[]> {
  return (await teamTimeOff(db, shopId, day)).filter((t) => t.from <= day).map(({ staffId, name, to }) => ({ staffId, name, until: to }));
}

export interface ShopSetup {
  shop: typeof shops.$inferSelect;
  staff: { id: string; name: string };
  zones: (typeof shopZones.$inferSelect)[];
  services: (typeof services.$inferSelect)[];
  windows: (typeof schedules.$inferSelect)[];
  daysOff: { id: string; onDate: string; reason: string | null }[];
  rules: typeof shopRules.$inferSelect;
}

/** Everything the owner sees on the setup page, and everything the public page is made of. */
export async function loadShop(db: Db, shop: typeof shops.$inferSelect): Promise<ShopSetup> {
  const member = await ownStaff(db, shop.id);
  const [zones, svc, windows, off, rules] = await Promise.all([
    db.select().from(shopZones).where(and(eq(shopZones.shopId, shop.id), eq(shopZones.active, true))).orderBy(asc(shopZones.position)),
    db.select().from(services).where(and(eq(services.shopId, shop.id), eq(services.active, true))).orderBy(asc(services.durationMinutes), asc(services.nameEn)),
    db.select().from(schedules).where(eq(schedules.staffId, member.id)).orderBy(asc(schedules.weekday), asc(schedules.startsAt)),
    db.select({ id: daysOff.id, onDate: daysOff.onDate, reason: daysOff.reason }).from(daysOff).where(eq(daysOff.staffId, member.id)).orderBy(asc(daysOff.onDate)),
    db.select().from(shopRules).where(eq(shopRules.shopId, shop.id)),
  ]);
  return { shop, staff: { id: member.id, name: member.name }, zones, services: svc, windows, daysOff: off, rules: rules[0] ?? refuse("AK_RULES_UNKNOWN") };
}

/** Overlapping or touching weekly windows of several people, as the shop's opening hours. */
function mergeWindows(rows: { weekday: number; startsAt: string; endsAt: string }[]): { weekday: number; startsAt: string; endsAt: string }[] {
  const sorted = [...rows].sort((a, b) => a.weekday - b.weekday || a.startsAt.localeCompare(b.startsAt));
  const out: { weekday: number; startsAt: string; endsAt: string }[] = [];
  for (const w of sorted) {
    const last = out[out.length - 1];
    if (last && last.weekday === w.weekday && w.startsAt <= last.endsAt) last.endsAt = w.endsAt > last.endsAt ? w.endsAt : last.endsAt;
    else out.push({ weekday: w.weekday, startsAt: w.startsAt, endsAt: w.endsAt });
  }
  return out;
}

/** A photo or a loop of the public page. */
export interface PublicMedia {
  id: string;
  url: string;
  webmUrl: string | null;
  mp4Url: string | null;
  altFr: string;
  altEn: string;
  captionFr: string | null;
  captionEn: string | null;
  wide: boolean;
}

/** What a visitor of the public page may know: no owner account, legal name, street address, tax numbers, staff id or days-off reasons. */
export interface PublicShop {
  shop: Pick<typeof shops.$inferSelect, "id" | "name" | "slug" | "timezone" | "taglineFr" | "taglineEn" | "area" | "bioFr" | "bioEn" | "publicPhone" | "publicEmail" | "seatUnitFr" | "seatUnitEn" | "registrant" | "businessType"> & {
    /** The first name shown for the person who works. */
    ownerName: string;
  };
  zones: Pick<typeof shopZones.$inferSelect, "id" | "name" | "lat" | "lng">[];
  services: Pick<typeof services.$inferSelect, "id" | "nameFr" | "nameEn" | "durationMinutes" | "priceCents" | "capacity" | "descriptionFr" | "descriptionEn" | "includedFr" | "includedEn" | "priceVaries">[];
  /** The shop's opening hours: everyone's weekly windows, merged. */
  windows: Pick<typeof schedules.$inferSelect, "weekday" | "startsAt" | "endsAt">[];
  /** Who works here (first names), to choose from; one person = no choice to offer. */
  team: { id: string; name: string }[];
  /** The days off, dates only (the reasons stay private). */
  daysOff: string[];
  rules: Pick<typeof shopRules.$inferSelect, "cancellationHours" | "bookingHorizonDays">;
  media: { cover: PublicMedia | null; gallery: PublicMedia[] };
  pageConfig?: ShopPageConfig;
  /** The languages the owner offers, and the translated texts (read by the page: the source language when a text is missing). */
  languages: ShopLanguages;
  translations: StoredTranslation[];
  /** The service to tag « Popular », from real bookings; null when none stands out. */
  popularServiceId: string | null;
  /** The shop as a place (B45): the wall, the latest reel, the profile links, the bulletin board and the published reviews. */
  community?: CommunityView;
}

/** The public page of a published shop, by its address; null when there is none (or it is not published). Projected here, once: a caller cannot leak a column. */
/** Where a former address of a published shop now leads: its current slug, or null (unknown, or the shop is not public). */
export async function currentSlugOf(db: Db, formerSlug: string): Promise<string | null> {
  const [row] = await db.select({ slug: shops.slug }).from(shopFormerSlugs).innerJoin(shops, eq(shops.id, shopFormerSlugs.shopId)).where(and(eq(shopFormerSlugs.slug, formerSlug), eq(shops.published, true)));
  return row?.slug ?? null;
}

export async function publicShop(db: Db, slug: string): Promise<PublicShop | null> {
  const [row] = await db.select().from(shops).where(and(eq(shops.slug, slug), eq(shops.published, true)));
  return row ? publicShopOf(db, row) : null;
}

/** The shop as its page would show it, published or not: the owner's preview of the draft (akinaza#402). The caller checked the member. */
export async function previewShop(db: Db, shopId: string): Promise<PublicShop | null> {
  const [row] = await db.select().from(shops).where(eq(shops.id, shopId));
  return row?.slug ? publicShopOf(db, row) : null;
}

async function publicShopOf(db: Db, row: typeof shops.$inferSelect): Promise<PublicShop> {
  const full = await loadShop(db, row);
  const team = await activeStaff(db, row.id);
  const everyone = team.length > 1 ? await db.select().from(schedules).where(inArray(schedules.staffId, team.map((m) => m.id))) : full.windows;
  const [media, pageConfig, languages, translations, counts, community] = await Promise.all([
    db.select().from(shopMedia).where(eq(shopMedia.shopId, row.id)).orderBy(asc(shopMedia.position)),
    shopPageConfigOf(db, row.id),
    shopLanguagesOf(db, row.id),
    translationsOf(db, row.id),
    db.execute(sql`
      SELECT a.service_id, count(b.id)::int AS bookings
        FROM bookings b JOIN appointments a ON a.id = b.appointment_id
       WHERE a.shop_id = ${row.id} AND b.status = 'booked' AND a.status <> 'cancelled'
       GROUP BY a.service_id`),
    communityOf(db, row.id),
  ]);
  const publicMedia = (m: typeof shopMedia.$inferSelect): PublicMedia => ({ id: m.id, url: m.url, webmUrl: m.webmUrl, mp4Url: m.mp4Url, altFr: m.altFr, altEn: m.altEn, captionFr: m.captionFr, captionEn: m.captionEn, wide: m.wide });
  const bookingCounts = (counts.rows as { service_id: string; bookings: number }[]).map((r) => ({ serviceId: r.service_id, bookings: r.bookings }));
  return {
    shop: { id: row.id, name: row.name, slug: row.slug, registrant: row.registrant, timezone: row.timezone, taglineFr: row.taglineFr, taglineEn: row.taglineEn, area: row.area, bioFr: row.bioFr, bioEn: row.bioEn, publicPhone: row.publicPhone, publicEmail: row.publicEmail, seatUnitFr: row.seatUnitFr, seatUnitEn: row.seatUnitEn, businessType: row.businessType, ownerName: full.staff.name },
    zones: full.zones.map((z) => ({ id: z.id, name: z.name, lat: z.lat, lng: z.lng })),
    services: full.services.map((s) => ({ id: s.id, nameFr: s.nameFr, nameEn: s.nameEn, durationMinutes: s.durationMinutes, priceCents: s.priceCents, capacity: s.capacity, descriptionFr: s.descriptionFr, descriptionEn: s.descriptionEn, includedFr: s.includedFr, includedEn: s.includedEn, priceVaries: s.priceVaries })),
    windows: mergeWindows(everyone),
    team: team.map((m) => ({ id: m.id, name: m.name })),
    daysOff: full.daysOff.map((d) => d.onDate),
    rules: { cancellationHours: full.rules.cancellationHours, bookingHorizonDays: full.rules.bookingHorizonDays },
    media: { cover: media.filter((m) => m.role === MediaRole.Cover).map(publicMedia)[0] ?? null, gallery: media.filter((m) => m.role === MediaRole.Gallery).map(publicMedia) },
    pageConfig,
    languages,
    translations,
    community,
    popularServiceId: popularServiceId(full.services.map((s) => ({ serviceId: s.id, bookings: bookingCounts.find((c) => c.serviceId === s.id)?.bookings ?? 0 }))),
  };
}

/**
 * Each member's day, for « who is here today » on the public page (akinaza#209): their weekly windows, today's visits as
 * bare time ranges (never a client nor a service) and the time off they are on. The page computes the state from it.
 */
export async function teamDay(db: Db, shopId: string, now: Date): Promise<Map<string, MemberDay>> {
  const [shop] = await db.select({ timezone: shops.timezone }).from(shops).where(eq(shops.id, shopId));
  if (!shop) return refuse("AK_SHOP_UNKNOWN");
  const today = localDay(now, shop.timezone);
  const team = await activeStaff(db, shopId);
  const ids = team.map((m) => m.id);
  if (!ids.length) return new Map();
  const [windows, visits, off] = await Promise.all([
    db.select({ staffId: schedules.staffId, weekday: schedules.weekday, startsAt: schedules.startsAt, endsAt: schedules.endsAt }).from(schedules).where(inArray(schedules.staffId, ids)),
    db.execute(sql`
      SELECT staff_id, lower(during) AS starts_at, upper(during) AS ends_at
        FROM appointments
       WHERE shop_id = ${shopId} AND status = 'booked'
         AND during && tstzrange(${addDays(now, -1).toISOString()}::timestamptz, ${addDays(now, 1).toISOString()}::timestamptz)`),
    offOn(db, shopId, today),
  ]);
  const rows = visits.rows as { staff_id: string; starts_at: Date | string; ends_at: Date | string }[];
  return new Map(
    team.map((m) => [
      m.id,
      {
        windows: windows.filter((w) => w.staffId === m.id),
        visits: rows.filter((v) => v.staff_id === m.id).map((v) => ({ startsAt: new Date(v.starts_at), endsAt: new Date(v.ends_at) })),
        offUntil: off.find((o) => o.staffId === m.id)?.until ?? null,
      },
    ]),
  );
}

const httpsUrl = z.string().trim().url().max(500).refine((u) => u.startsWith("https://"), { message: "https only" });
export const mediaInputSchema = z.object({
  url: httpsUrl,
  webmUrl: httpsUrl.optional(),
  mp4Url: httpsUrl.optional(),
  altFr: z.string().trim().max(200).default(""),
  altEn: z.string().trim().max(200).default(""),
  captionFr: z.string().trim().max(80).optional(),
  captionEn: z.string().trim().max(80).optional(),
  wide: z.boolean().default(false),
});
export type MediaInput = z.input<typeof mediaInputSchema>;
/** What the owner sends: a cover (or none) and up to twelve gallery pictures. */
export const shopMediaInputSchema = z.object({ cover: mediaInputSchema.nullish(), gallery: z.array(mediaInputSchema).max(12).optional() });

/** Replaces the shop's cover and gallery (the files are on the media CDN; only their https addresses are kept). */
export async function saveShopMedia(db: Db, shopId: string, input: { cover?: MediaInput | null; gallery?: MediaInput[] }): Promise<void> {
  const cover = input.cover ? mediaInputSchema.parse(input.cover) : null;
  const gallery = z.array(mediaInputSchema).max(12).parse(input.gallery ?? []);
  await db.transaction(async (tx) => {
    await tx.delete(shopMedia).where(eq(shopMedia.shopId, shopId));
    const rows = [...(cover ? [{ ...cover, role: MediaRole.Cover }] : []), ...gallery.map((g) => ({ ...g, role: MediaRole.Gallery }))];
    if (rows.length === 0) return;
    await tx.insert(shopMedia).values(rows.map((m, position) => ({ shopId, role: m.role, url: m.url, webmUrl: m.webmUrl ?? null, mp4Url: m.mp4Url ?? null, altFr: m.altFr, altEn: m.altEn, captionFr: m.captionFr ?? null, captionEn: m.captionEn ?? null, wide: m.wide, position })));
  });
}

type Reader = Db | Tx;

/** The visits already on a worker's calendar between two instants, with their seats (a salon-style visit with a client counts one). */
async function takenVisits(tx: Reader, staffId: string, from: Date, to: Date): Promise<TakenVisit[]> {
  const result = await tx.execute(sql`
    SELECT a.service_id, a.zone_id, lower(a.during) AS starts_at, upper(a.during) AS ends_at,
           greatest((SELECT count(*) FROM bookings b WHERE b.appointment_id = a.id AND b.status = 'booked'), CASE WHEN a.client_id IS NULL THEN 0 ELSE 1 END)::int AS seats
      FROM appointments a
     WHERE a.staff_id = ${staffId} AND a.status <> 'cancelled' AND a.during && tstzrange(${from.toISOString()}::timestamptz, ${to.toISOString()}::timestamptz)`);
  return (result.rows as { service_id: string; zone_id: string | null; starts_at: string; ends_at: string; seats: number }[]).map((r) => ({ serviceId: r.service_id, zoneId: r.zone_id, startsAt: new Date(r.starts_at), endsAt: new Date(r.ends_at), seatsTaken: r.seats }));
}

export interface SlotQuery {
  shopId: string;
  serviceId: string;
  zoneId: string | null;
  now: Date;
  /** One person's times; omitted = anyone's. */
  staffId?: string | null;
  /** Local day to start from (`YYYY-MM-DD`); default today in the shop's zone. */
  fromDay?: string;
  days?: number;
}

/** A start time a client may book, and the person who would take it. */
export type StaffSlot = Slot & { staffId: string };

/** The start times a client may book for a service in a zone — computed from the weekly hours, days off, rules and visits of one person, or of anyone (the union, each time once). */
export async function listSlots(db: Reader, query: SlotQuery): Promise<StaffSlot[]> {
  const [shop] = await db.select().from(shops).where(eq(shops.id, query.shopId));
  if (!shop) return refuse("AK_SHOP_UNKNOWN");
  const [service] = await db.select().from(services).where(and(eq(services.id, query.serviceId), eq(services.shopId, shop.id), eq(services.active, true)));
  if (!service) return refuse("AK_SERVICE_UNKNOWN");
  const members = query.staffId ? [await staffFor(db, shop.id, query.staffId)] : await activeStaff(db, shop.id);
  if (members.length === 0) return refuse("AK_STAFF_UNKNOWN");
  const [rules] = await db.select().from(shopRules).where(eq(shopRules.shopId, shop.id));
  if (!rules) return refuse("AK_RULES_UNKNOWN");
  const today = localDay(query.now, shop.timezone);
  const fromDay = query.fromDay && query.fromDay > today ? query.fromDay : today;
  const horizonEnd = addLocalDays(today, rules.bookingHorizonDays);
  const days = Math.max(0, Math.min(query.days ?? rules.bookingHorizonDays, 62, daysBetween(fromDay, horizonEnd)));
  const rangeStart = addDays(query.now, -1);
  const rangeEnd = addDays(query.now, daysBetween(today, fromDay) + days + 2);
  const byStart = new Map<number, StaffSlot>();
  for (const member of members) {
    const [windows, off] = await Promise.all([db.select().from(schedules).where(eq(schedules.staffId, member.id)), db.select({ d: daysOff.onDate }).from(daysOff).where(eq(daysOff.staffId, member.id))]);
    const visits = await takenVisits(db, member.id, rangeStart, rangeEnd);
    const busy = await busyBetween(db, shop.id, member.id, { from: rangeStart, to: rangeEnd });
    const asWindows: WeeklyWindow[] = windows.map((w) => ({ weekday: w.weekday, startsAt: w.startsAt.slice(0, 5), endsAt: w.endsAt.slice(0, 5) }));
    const open = openSlots({
      timezone: shop.timezone,
      now: query.now,
      fromDay,
      days,
      windows: asWindows,
      daysOff: off.map((o) => o.d),
      serviceId: service.id,
      zoneId: query.zoneId,
      durationMinutes: service.durationMinutes,
      stepMinutes: rules.slotStepMinutes,
      capacity: service.capacity,
      minNoticeMinutes: rules.minNoticeMinutes,
      visits,
      busy,
    });
    // « Anyone »: a time is offered once; a group visit already started is preferred (it fills the visit), else the first who joined.
    for (const slot of open) {
      const key = slot.startsAt.getTime();
      const held = byStart.get(key);
      if (!held || (slot.joins && !held.joins)) byStart.set(key, { ...slot, staffId: member.id });
    }
  }
  return [...byStart.values()].sort((x, y) => compareAsc(x.startsAt, y.startsAt));
}

function daysBetween(from: string, to: string): number {
  let n = 0;
  for (let d = from; d < to && n < 400; d = addLocalDays(d, 1)) n++;
  return n;
}

export const joinInputSchema = z.object({
  fullName: text(120),
  phone: z.string().trim().min(7).max(40),
  language: z.enum(["fr", "en"]).default("fr"),
  /** The service consent is the file itself: without it there is no file. */
  consentService: z.literal(true),
  consentReminders: z.boolean().default(false),
});

/** A signed-in person opens their file at a shop (once): their name, a phone, the consents they chose. */
export async function joinShop(db: Db, accountId: string, accountEmail: string, shopId: string, raw: z.input<typeof joinInputSchema>): Promise<{ clientId: string; created: boolean }> {
  const input = joinInputSchema.parse(raw);
  const [shop] = await db.select({ id: shops.id }).from(shops).where(and(eq(shops.id, shopId), eq(shops.published, true)));
  if (!shop) return refuse("AK_SHOP_UNKNOWN");
  const [existing] = await db.select({ id: clients.id, erasedAt: clients.erasedAt }).from(clients).where(and(eq(clients.shopId, shopId), eq(clients.accountId, accountId)));
  if (existing) return { clientId: existing.id, created: false };
  const [row] = await db.insert(clients).values({ shopId, accountId, fullName: input.fullName, email: accountEmail.toLowerCase(), phone: input.phone, language: input.language }).returning({ id: clients.id });
  await recordConsent(db, row!.id, "service", true, CONSENT_TEXT_VERSION);
  await recordConsent(db, row!.id, "reminders", input.consentReminders, CONSENT_TEXT_VERSION);
  return { clientId: row!.id, created: true };
}

/** The client files of an account (one per shop it joined), erased ones excluded. */
export async function clientFilesOf(db: Db, accountId: string) {
  return db
    .select({ id: clients.id, fullName: clients.fullName, phone: clients.phone, language: clients.language, shopId: shops.id, shopName: shops.name, shopSlug: shops.slug, businessType: shops.businessType, timezone: shops.timezone })
    .from(clients)
    .innerJoin(shops, eq(shops.id, clients.shopId))
    .where(and(eq(clients.accountId, accountId), isNull(clients.erasedAt)))
    .orderBy(asc(shops.name));
}

export async function addDependant(db: Db, clientId: string, raw: z.input<typeof dependantInputSchema>): Promise<string> {
  const input: DependantInput = dependantInputSchema.parse(raw);
  const [client] = await db.select({ shopId: clients.shopId }).from(clients).where(and(eq(clients.id, clientId), isNull(clients.erasedAt)));
  if (!client) return refuse("AK_CLIENT_UNKNOWN");
  const [row] = await db.insert(dependants).values({ shopId: client.shopId, clientId, kind: input.kind, name: input.name, profile: input.profile }).returning({ id: dependants.id });
  return row!.id;
}

/** The entry that stands for a client who books for themselves (a business that has no dogs): made once, named like the client. */
async function selfDependant(db: Tx, client: { id: string; shopId: string; fullName: string }): Promise<string> {
  const [existing] = await db.select({ id: dependants.id }).from(dependants).where(and(eq(dependants.clientId, client.id), eq(dependants.kind, "other"), isNull(dependants.erasedAt))).orderBy(asc(dependants.createdAt)).limit(1);
  if (existing) return existing.id;
  const [row] = await db.insert(dependants).values({ shopId: client.shopId, clientId: client.id, kind: "other", name: client.fullName }).returning({ id: dependants.id });
  return row!.id;
}

export async function dependantsOf(db: Db, clientId: string) {
  return db.select().from(dependants).where(and(eq(dependants.clientId, clientId), isNull(dependants.erasedAt))).orderBy(asc(dependants.name));
}

/** Seals a client's access notes (keys, door codes) with the application's key; `null` clears them. */
export async function setAccessNotes(db: Db, key: Buffer, clientId: string, notes: string | null): Promise<void> {
  const clean = notes?.trim() ? text(500).parse(notes) : null;
  const [row] = await db.update(clients).set({ accessNotesEnc: clean === null ? null : sealField(clean, key, clientId) }).where(and(eq(clients.id, clientId), isNull(clients.erasedAt))).returning({ id: clients.id });
  if (!row) refuse("AK_CLIENT_UNKNOWN");
}

/** Opens a client's access notes (the caller has checked who may, and writes the audit trail). */
export async function revealAccessNotes(db: Db, key: Buffer, clientId: string): Promise<string | null> {
  const [row] = await db.select({ sealed: clients.accessNotesEnc }).from(clients).where(eq(clients.id, clientId));
  return row?.sealed ? openField(row.sealed, key, clientId) : null;
}

export interface BookInput {
  clientId: string;
  serviceId: string;
  zoneId: string | null;
  dependantIds: string[];
  startsAt: Date;
  now: Date;
  /** The person asked for; omitted = anyone free at that time. */
  staffId?: string | null;
}

/**
 * A client books a service for some of their dependants. Inside one transaction, with the worker's row locked so two
 * bookings queue: the slot must be one the shop offers *now*, then the visit is created (or the group visit joined) and
 * a seat per dependant is taken — the database refuses a full visit or a double booking whatever happens above.
 */
export async function bookVisit(db: Db, input: BookInput): Promise<{ appointmentId: string; bookingIds: string[]; joined: boolean }> {
  if (new Set(input.dependantIds).size !== input.dependantIds.length) refuse("AK_DEPENDANTS_REQUIRED");
  try {
    return await db.transaction(async (tx) => {
      const [client] = await tx.select().from(clients).where(and(eq(clients.id, input.clientId), isNull(clients.erasedAt)));
      if (!client) return refuse("AK_CLIENT_UNKNOWN");
      const [shop] = await tx.select().from(shops).where(and(eq(shops.id, client.shopId), eq(shops.published, true)));
      if (!shop) return refuse("AK_SHOP_UNKNOWN");
      const [service] = await tx.select().from(services).where(and(eq(services.id, input.serviceId), eq(services.shopId, shop.id), eq(services.active, true)));
      if (!service) return refuse("AK_SERVICE_UNKNOWN");
      const zones = await tx.select().from(shopZones).where(and(eq(shopZones.shopId, shop.id), eq(shopZones.active, true)));
      if (zones.length > 0 && !zones.some((z) => z.id === input.zoneId)) refuse("AK_ZONE_REQUIRED");
      // A pet-care shop books for a dog. Any other business takes the client for themselves: their own entry stands for them.
      const dependantIds = input.dependantIds.length > 0 ? input.dependantIds : vocabularyOf(shop.businessType).dependants ? refuse("AK_DEPENDANTS_REQUIRED") : [await selfDependant(tx, client)];
      if (dependantIds.length > service.capacity) refuse("AK_CAPACITY_FULL");
      if (input.staffId) await staffFor(tx, shop.id, input.staffId);
      // Everyone's row is locked in a fixed order, so two bookings (for anyone, or for the same person) queue.
      await tx.execute(sql`SELECT 1 FROM staff WHERE shop_id = ${shop.id} AND active ORDER BY id FOR UPDATE`);
      const slots = await listSlots(tx, { shopId: shop.id, serviceId: service.id, zoneId: input.zoneId, now: input.now, fromDay: localDay(input.startsAt, shop.timezone), days: 1, staffId: input.staffId });
      const slot = slots.find((s) => s.startsAt.getTime() === input.startsAt.getTime());
      if (!slot) return refuse("AK_SLOT_UNAVAILABLE");
      if (slot.seatsLeft < dependantIds.length) refuse("AK_CAPACITY_FULL");
      let appointmentId: string;
      if (slot.joins) {
        const found = await tx.execute(sql`
          SELECT id FROM appointments WHERE staff_id = ${slot.staffId} AND service_id = ${service.id} AND status <> 'cancelled'
             AND zone_id IS NOT DISTINCT FROM ${input.zoneId} AND lower(during) = ${slot.startsAt.toISOString()}::timestamptz`);
        appointmentId = (found.rows[0] as { id: string } | undefined)?.id ?? refuse("AK_SLOT_UNAVAILABLE");
      } else {
        const [row] = await tx
          .insert(appointments)
          .values({ shopId: shop.id, staffId: slot.staffId, serviceId: service.id, clientId: service.capacity === 1 ? client.id : null, zoneId: input.zoneId, during: `[${slot.startsAt.toISOString()},${slot.endsAt.toISOString()})` })
          .returning({ id: appointments.id });
        appointmentId = row!.id;
      }
      const rows = await tx.insert(bookings).values(dependantIds.map((dependantId) => ({ appointmentId, clientId: client.id, dependantId }))).returning({ id: bookings.id });
      return { appointmentId, bookingIds: rows.map((r) => r.id), joined: slot.joins };
    });
  } catch (error) {
    const code = akCode(error);
    if (code === "AK_CAPACITY_FULL" || code === "AK_BOOKING_OWNERSHIP") throw new ShopError(code);
    if ((error as { cause?: { constraint?: string } }).cause?.constraint === "appointments_no_double_booking") throw new ShopError("AK_SLOT_UNAVAILABLE");
    if ((error as { cause?: { constraint?: string } }).cause?.constraint === "bookings_one_seat") throw new ShopError("AK_ALREADY_BOOKED");
    throw error;
  }
}

/** A client cancels one of their bookings, until the shop's cancellation window before the visit. The last seat freed frees the visit. */
export async function cancelBooking(db: Db, clientId: string, bookingId: string, now: Date): Promise<void> {
  await db.transaction(async (tx) => {
    const found = await tx.execute(sql`
      SELECT b.id, b.appointment_id, lower(a.during) AS starts_at, r.cancellation_hours, a.checked_in_at
        FROM bookings b JOIN appointments a ON a.id = b.appointment_id JOIN shop_rules r ON r.shop_id = a.shop_id
       WHERE b.id = ${bookingId} AND b.client_id = ${clientId} AND b.status = 'booked' FOR UPDATE OF b, a`);
    const row = found.rows[0] as { appointment_id: string; starts_at: string; cancellation_hours: number; checked_in_at: string | null } | undefined;
    if (!row) return refuse("AK_BOOKING_UNKNOWN");
    if (row.checked_in_at || !canCancel(new Date(row.starts_at), now, row.cancellation_hours)) refuse("AK_CANCEL_TOO_LATE");
    await tx.update(bookings).set({ status: "cancelled", cancelledAt: now }).where(eq(bookings.id, bookingId));
    const [left] = await tx.select({ n: sql<number>`count(*)::int` }).from(bookings).where(and(eq(bookings.appointmentId, row.appointment_id), eq(bookings.status, "booked")));
    if (left!.n === 0) await tx.update(appointments).set({ status: "cancelled" }).where(eq(appointments.id, row.appointment_id));
  });
}

/** The shop's own rules (cancellation window, horizon, step, notice, report-link life) — validated against the same bounds the database keeps. */
export async function saveRules(db: Db, shopId: string, raw: ShopRules): Promise<void> {
  const { paymentTermsDays, ...rules } = shopRulesSchema.parse(raw);
  await db.transaction(async (tx) => {
    await tx.update(shopRules).set(rules).where(eq(shopRules.shopId, shopId));
    await tx.update(shops).set({ paymentTermsDays }).where(eq(shops.id, shopId));
  });
}

/** A client file, if it belongs to the signed-in account (and is not erased). */
export async function ownClient(db: Db, accountId: string, clientId: string) {
  const [row] = await db.select().from(clients).where(and(eq(clients.id, clientId), eq(clients.accountId, accountId), isNull(clients.erasedAt)));
  return row ?? null;
}

/** A client file of the shop (the walker's). */
export async function shopClient(db: Db, shopId: string, clientId: string) {
  const [row] = await db.select().from(clients).where(and(eq(clients.id, clientId), eq(clients.shopId, shopId), isNull(clients.erasedAt)));
  return row ?? null;
}

/** The shop's cover and gallery as the owner edits them (a draft shop included: the public read needs a published one). */
export async function shopMediaOf(db: Db, shopId: string): Promise<{ cover: PublicMedia | null; gallery: PublicMedia[] }> {
  const rows = await db.select().from(shopMedia).where(eq(shopMedia.shopId, shopId)).orderBy(asc(shopMedia.position));
  const one = (m: typeof shopMedia.$inferSelect): PublicMedia => ({ id: m.id, url: m.url, webmUrl: m.webmUrl, mp4Url: m.mp4Url, altFr: m.altFr, altEn: m.altEn, captionFr: m.captionFr, captionEn: m.captionEn, wide: m.wide });
  return { cover: rows.filter((m) => m.role === MediaRole.Cover).map(one)[0] ?? null, gallery: rows.filter((m) => m.role === MediaRole.Gallery).map(one) };
}

/** What the confirmation page shows of a booking: when, with whom, where, and whether it can still be cancelled. */
export interface BookingDetail {
  id: string;
  cancelled: boolean;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  shop: { name: string; slug: string; address: string; publicPhone: string | null };
  service: { id: string; nameFr: string; nameEn: string; durationMinutes: number; priceCents: number };
  /** The first name of the person who takes the visit. */
  staffName: string;
  cancellationHours: number;
  cancellable: boolean;
}

/** One booking of a signed-in account (never someone else's), as the confirmation page reads it; null when it is not theirs. */
export async function bookingDetail(db: Db, accountId: string, bookingId: string, now: Date): Promise<BookingDetail | null> {
  const found = await db.execute(sql`
    SELECT b.id, (b.status = 'cancelled') AS cancelled, lower(a.during) AS starts_at, upper(a.during) AS ends_at, a.checked_in_at,
           s.name AS shop_name, s.slug, s.address, s.public_phone, s.timezone,
           v.id AS service_id, v.name_fr, v.name_en, v.duration_minutes, v.price_cents, m.name AS staff_name, r.cancellation_hours
      FROM bookings b
      JOIN clients c ON c.id = b.client_id AND c.account_id = ${accountId} AND c.erased_at IS NULL
      JOIN appointments a ON a.id = b.appointment_id
      JOIN shops s ON s.id = a.shop_id
      JOIN services v ON v.id = a.service_id
      JOIN staff m ON m.id = a.staff_id
      JOIN shop_rules r ON r.shop_id = s.id
     WHERE b.id = ${bookingId}`);
  const r = found.rows[0] as
    | { id: string; cancelled: boolean; starts_at: string; ends_at: string; checked_in_at: string | null; shop_name: string; slug: string; address: string; public_phone: string | null; timezone: string; service_id: string; name_fr: string; name_en: string; duration_minutes: number; price_cents: number; staff_name: string; cancellation_hours: number }
    | undefined;
  if (!r) return null;
  const startsAt = new Date(r.starts_at);
  return {
    id: r.id,
    cancelled: r.cancelled,
    startsAt,
    endsAt: new Date(r.ends_at),
    timezone: r.timezone,
    shop: { name: r.shop_name, slug: r.slug, address: r.address, publicPhone: r.public_phone },
    service: { id: r.service_id, nameFr: r.name_fr, nameEn: r.name_en, durationMinutes: r.duration_minutes, priceCents: r.price_cents },
    staffName: r.staff_name,
    cancellationHours: r.cancellation_hours,
    cancellable: !r.cancelled && !r.checked_in_at && canCancel(startsAt, now, r.cancellation_hours),
  };
}
