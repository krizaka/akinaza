import { ANNOUNCEMENT_LIMITS, REVIEW_STATE, WALL_KIND, externalReel, REVIEW_LIMITS, REVIEW_STATES, SOCIAL_PLATFORMS, socialLink, type SocialPlatform, type WallItem, wallSchema, type WallTexture } from "@akinaza/core";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "./client";
import { ShopError } from "./errors";
import { isPublicShop, shopAnnouncements, shopReels, shopReviews, shops, shopSocialLinks, shopWall, shopWallItems } from "./schema";

/**
 * The shop as a place (akinaza#236, B45): the wall, the reels, the profile links, the bulletin board and the reviews of the public page.
 * Every function takes the shop it works on and never a bare id: another shop's row is simply not found (`false`), whatever the id says.
 */

// ---- the wall ------------------------------------------------------------------------------------------------------------------------------------

export type WallItemRow = WallItem & { id: string };
export interface WallRow {
  texture: WallTexture;
  items: WallItemRow[];
}

const itemOf = (r: typeof shopWallItems.$inferSelect): WallItemRow => {
  const place = { id: r.id, x: r.x, y: r.y, rotation: r.rotation, z: r.z };
  if (r.kind === WALL_KIND.polaroid) return { ...place, kind: "polaroid", attachment: r.attachment, imageUrl: r.imageUrl ?? "", altFr: r.altFr, altEn: r.altEn, captionFr: r.captionFr, captionEn: r.captionEn };
  if (r.kind === WALL_KIND.note) return { ...place, kind: "note", attachment: r.attachment, textFr: r.textFr, textEn: r.textEn, signature: r.signature };
  return { ...place, kind: "sign", variant: r.variant ?? "enamel" };
};

export async function wallOf(db: Db, shopId: string): Promise<WallRow> {
  const [[wall], items] = await Promise.all([db.select().from(shopWall).where(eq(shopWall.shopId, shopId)), db.select().from(shopWallItems).where(eq(shopWallItems.shopId, shopId)).orderBy(asc(shopWallItems.z), asc(shopWallItems.id))]);
  return { texture: wall?.texture ?? "plaster", items: items.map(itemOf) };
}

/** Replaces the whole wall in one transaction; `max` is `limits.wallItems`. The input is validated as it came (bounds, https, lengths): a bad item leaves the wall as it was. */
export async function saveWall(db: Db, shopId: string, input: unknown, max: number): Promise<void> {
  const wall = wallSchema(max).parse(input);
  await db.transaction(async (tx) => {
    await tx.insert(shopWall).values({ shopId, texture: wall.texture }).onConflictDoUpdate({ target: shopWall.shopId, set: { texture: wall.texture, updatedAt: sql`now()` } });
    await tx.delete(shopWallItems).where(eq(shopWallItems.shopId, shopId));
    if (!wall.items.length) return;
    await tx.insert(shopWallItems).values(wall.items.map((i) => ({
      shopId, kind: i.kind, x: i.x, y: i.y, rotation: i.rotation, z: i.z,
      ...(i.kind === WALL_KIND.polaroid ? { attachment: i.attachment, imageUrl: i.imageUrl, altFr: i.altFr, altEn: i.altEn, captionFr: i.captionFr, captionEn: i.captionEn } : {}),
      ...(i.kind === WALL_KIND.note ? { attachment: i.attachment, textFr: i.textFr, textEn: i.textEn, signature: i.signature } : {}),
      ...(i.kind === WALL_KIND.sign ? { variant: i.variant } : {}),
    })));
  });
}

// ---- the reels -----------------------------------------------------------------------------------------------------------------------------------

// @fixed: a shop keeps a dozen reels; the page shows the latest, the rest is the owner's archive.
export const MAX_REELS = 12;

export interface ReelRow {
  id: string;
  kind: "upload" | "external";
  mp4Url: string | null;
  webmUrl: string | null;
  posterUrl: string | null;
  seconds: number | null;
  platform: "tiktok" | "youtube-shorts" | "instagram" | null;
  externalUrl: string | null;
  embedUrl: string | null;
  titleFr: string;
  titleEn: string;
  createdAt: Date;
}

export async function reelsOf(db: Db, shopId: string): Promise<ReelRow[]> {
  return db.select().from(shopReels).where(eq(shopReels.shopId, shopId)).orderBy(desc(shopReels.createdAt), desc(shopReels.id));
}

const httpsOrNull = z.string().max(500).regex(/^https:\/\//).nullable();
const titles = { titleFr: z.string().max(60), titleEn: z.string().max(60) };
const uploadedReelSchema = z.object({ mp4Url: httpsOrNull, webmUrl: httpsOrNull, posterUrl: httpsOrNull, seconds: z.number().positive().max(3600), ...titles }).refine((r) => r.mp4Url || r.webmUrl, { message: "A video address" });
const externalTitles = z.object({ ...titles, posterUrl: httpsOrNull.optional() });

async function assertRoom(tx: Pick<Db, "select">, shopId: string): Promise<void> {
  const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(shopReels).where(eq(shopReels.shopId, shopId));
  if ((row?.n ?? 0) >= MAX_REELS) throw new ShopError("AK_REEL_LIMIT");
}

export async function addUploadedReel(db: Db, shopId: string, input: z.input<typeof uploadedReelSchema>): Promise<string> {
  const reel = uploadedReelSchema.parse(input);
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM shops WHERE id = ${shopId} FOR UPDATE`);
    await assertRoom(tx, shopId);
    const [row] = await tx.insert(shopReels).values({ shopId, kind: "upload", ...reel }).returning({ id: shopReels.id });
    return row!.id;
  });
}

/** A link to a TikTok, a YouTube Short or an Instagram reel: an exact host and path (`externalReel`), the address of the player kept for the click. */
export async function addExternalReel(db: Db, shopId: string, url: string, raw: z.input<typeof externalTitles>): Promise<string> {
  const link = externalReel(url);
  if (!link) throw new ShopError("AK_REEL_LINK");
  const names = externalTitles.parse(raw);
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM shops WHERE id = ${shopId} FOR UPDATE`);
    await assertRoom(tx, shopId);
    const [row] = await tx.insert(shopReels).values({ shopId, kind: "external", platform: link.platform, externalUrl: link.url, embedUrl: link.embedUrl, ...names, posterUrl: names.posterUrl ?? null }).returning({ id: shopReels.id });
    return row!.id;
  });
}

export async function removeReel(db: Db, shopId: string, reelId: string): Promise<boolean> {
  const rows = await db.delete(shopReels).where(and(eq(shopReels.shopId, shopId), eq(shopReels.id, reelId))).returning({ id: shopReels.id });
  return rows.length > 0;
}

// ---- the profile links ---------------------------------------------------------------------------------------------------------------------------

export type SocialLinks = Partial<Record<SocialPlatform, string>>;

export async function socialLinksOf(db: Db, shopId: string): Promise<SocialLinks> {
  const rows = await db.select().from(shopSocialLinks).where(eq(shopSocialLinks.shopId, shopId)).orderBy(asc(shopSocialLinks.platform));
  return Object.fromEntries(rows.map((r) => [r.platform, r.url]));
}

/** Sets or (with null) removes the links it names; a platform it does not name stays. Each address must be on its own platform's host. */
export async function saveSocialLinks(db: Db, shopId: string, input: Partial<Record<SocialPlatform, string | null>>): Promise<void> {
  const entries = Object.entries(input).filter(([platform]) => (SOCIAL_PLATFORMS as readonly string[]).includes(platform)) as [SocialPlatform, string | null][];
  for (const [platform, url] of entries) if (url !== null && !socialLink(platform, url)) throw new ShopError("AK_SOCIAL_LINK");
  await db.transaction(async (tx) => {
    for (const [platform, url] of entries) {
      if (url === null) await tx.delete(shopSocialLinks).where(and(eq(shopSocialLinks.shopId, shopId), eq(shopSocialLinks.platform, platform)));
      else await tx.insert(shopSocialLinks).values({ shopId, platform, url }).onConflictDoUpdate({ target: [shopSocialLinks.shopId, shopSocialLinks.platform], set: { url } });
    }
  });
}

// ---- the bulletin board --------------------------------------------------------------------------------------------------------------------------

const announcementSchema = z.object({
  textFr: z.string().max(ANNOUNCEMENT_LIMITS.text),
  textEn: z.string().max(ANNOUNCEMENT_LIMITS.text),
  photoUrl: httpsOrNull,
  photoAlt: z.string().max(200),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
}).refine((a) => a.textFr.trim().length + a.textEn.trim().length > 0, { message: "A flyer needs a word", path: ["textFr"] });
export type AnnouncementInput = z.input<typeof announcementSchema>;
export type AnnouncementRow = typeof shopAnnouncements.$inferSelect;

// @fixed: a shop keeps thirty flyers on file; three are pinned at a time.
const MAX_ANNOUNCEMENTS = 30;

export async function announcementsOf(db: Db, shopId: string): Promise<AnnouncementRow[]> {
  return db.select().from(shopAnnouncements).where(eq(shopAnnouncements.shopId, shopId)).orderBy(desc(shopAnnouncements.createdAt), desc(shopAnnouncements.id));
}

export async function addAnnouncement(db: Db, shopId: string, input: AnnouncementInput): Promise<string> {
  const flyer = announcementSchema.parse(input);
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM shops WHERE id = ${shopId} FOR UPDATE`);
    const [count] = await tx.select({ n: sql<number>`count(*)::int` }).from(shopAnnouncements).where(eq(shopAnnouncements.shopId, shopId));
    if ((count?.n ?? 0) >= MAX_ANNOUNCEMENTS) throw new ShopError("AK_ANNOUNCEMENT_LIMIT");
    const [row] = await tx.insert(shopAnnouncements).values({ shopId, ...flyer }).returning({ id: shopAnnouncements.id });
    return row!.id;
  });
}

export async function removeAnnouncement(db: Db, shopId: string, id: string): Promise<boolean> {
  const rows = await db.delete(shopAnnouncements).where(and(eq(shopAnnouncements.shopId, shopId), eq(shopAnnouncements.id, id))).returning({ id: shopAnnouncements.id });
  return rows.length > 0;
}

// ---- the neighbourhood feed ----------------------------------------------------------------------------------------------------------------------

export interface FeedFlyerRow {
  id: string;
  textFr: string;
  textEn: string;
  photoUrl: string | null;
  photoAlt: string;
  endsOn: string | null;
  createdAt: Date;
  shopName: string;
  shopSlug: string;
  area: string | null;
}

// @fixed: the feed reads the newest flyers of the published shops and cuts them to a handful afterwards; two hundred rows is more than any home shows.
const FEED_READ = 200;

/**
 * The flyers still up in every published shop that has an address and a locality (the shop's local day decides « still up »), newest first.
 * Only what the owner already pinned on the public page leaves the shop: no street, no client, no figure.
 */
export async function feedFlyers(db: Db): Promise<FeedFlyerRow[]> {
  return db
    .select({
      id: shopAnnouncements.id,
      textFr: shopAnnouncements.textFr,
      textEn: shopAnnouncements.textEn,
      photoUrl: shopAnnouncements.photoUrl,
      photoAlt: shopAnnouncements.photoAlt,
      endsOn: shopAnnouncements.endsOn,
      createdAt: shopAnnouncements.createdAt,
      shopName: shops.name,
      shopSlug: sql<string>`${shops.slug}`,
      area: shops.area,
    })
    .from(shopAnnouncements)
    .innerJoin(shops, eq(shops.id, shopAnnouncements.shopId))
    .where(and(isPublicShop(), sql`${shops.slug} IS NOT NULL`, sql`coalesce(${shops.area}, '') <> ''`, sql`(${shopAnnouncements.endsOn} IS NULL OR ${shopAnnouncements.endsOn} >= (now() AT TIME ZONE ${shops.timezone})::date)`))
    .orderBy(desc(shopAnnouncements.createdAt), desc(shopAnnouncements.id))
    .limit(FEED_READ);
}

// ---- the reviews ---------------------------------------------------------------------------------------------------------------------------------

const reviewSchema = z.object({
  clientId: z.string().uuid().nullable().optional(),
  firstName: z.string().min(1).max(REVIEW_LIMITS.name),
  lastInitial: z.string().max(2).default(""),
  rating: z.number().int().min(1).max(5),
  body: z.string().max(REVIEW_LIMITS.text).default(""),
  serviceName: z.string().max(REVIEW_LIMITS.service).default(""),
  verified: z.boolean().default(false),
  state: z.enum(REVIEW_STATES).default("published"),
});
export type ReviewInput = z.input<typeof reviewSchema>;
export type ReviewRow = typeof shopReviews.$inferSelect;

/** Every review of the shop, for its owner (hidden ones included). */
export async function reviewsOf(db: Db, shopId: string): Promise<ReviewRow[]> {
  return db.select().from(shopReviews).where(eq(shopReviews.shopId, shopId)).orderBy(desc(shopReviews.createdAt), desc(shopReviews.id));
}

export async function addReview(db: Db, shopId: string, input: ReviewInput): Promise<string> {
  const review = reviewSchema.parse(input);
  const [row] = await db.insert(shopReviews).values({ shopId, ...review, clientId: review.clientId ?? null }).returning({ id: shopReviews.id });
  return row!.id;
}

export async function replyToReview(db: Db, shopId: string, reviewId: string, reply: string): Promise<boolean> {
  const text = z.string().max(REVIEW_LIMITS.reply).parse(reply);
  const rows = await db.update(shopReviews).set({ reply: text }).where(and(eq(shopReviews.shopId, shopId), eq(shopReviews.id, reviewId))).returning({ id: shopReviews.id });
  return rows.length > 0;
}

/** The owner hides a review or shows it again; what the administrator removed stays removed. */
export async function setReviewState(db: Db, shopId: string, reviewId: string, state: "published" | "hidden_by_owner"): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ state: shopReviews.state }).from(shopReviews).where(and(eq(shopReviews.shopId, shopId), eq(shopReviews.id, reviewId))).for("update");
    if (!row) return false;
    if (row.state === REVIEW_STATE.removedByAdmin) throw new ShopError("AK_REVIEW_REMOVED");
    await tx.update(shopReviews).set({ state }).where(eq(shopReviews.id, reviewId));
    return true;
  });
}

// ---- what a visitor reads ------------------------------------------------------------------------------------------------------------------------

export interface PublicReview {
  id: string;
  firstName: string;
  lastInitial: string;
  rating: number;
  body: string;
  serviceName: string;
  reply: string;
  createdAt: Date;
}
export interface CommunityView {
  wall: WallRow;
  /** The latest reel, if any. */
  reel: ReelRow | null;
  /** Every reel, the newest first. */
  reels: ReelRow[];
  links: SocialLinks;
  announcements: AnnouncementRow[];
  /** Published reviews only; the verified flag is kept for the score. */
  reviews: (PublicReview & { verified: boolean; state: string })[];
}

/** The public projection of the shop as a place: no client id, no hidden or removed review, no e-mail. */
export async function communityOf(db: Db, shopId: string): Promise<CommunityView> {
  const [wall, reels, links, announcements, reviews] = await Promise.all([wallOf(db, shopId), reelsOf(db, shopId), socialLinksOf(db, shopId), announcementsOf(db, shopId), reviewsOf(db, shopId)]);
  return {
    wall,
    reel: reels[0] ?? null,
    reels,
    links,
    announcements,
    reviews: reviews.filter((r) => r.state === REVIEW_STATE.published).map((r) => ({ id: r.id, firstName: r.firstName, lastInitial: r.lastInitial, rating: r.rating, body: r.body, serviceName: r.serviceName, reply: r.reply, createdAt: r.createdAt, verified: r.verified, state: r.state })),
  };
}
