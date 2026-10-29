import { type FramePaper, shopTypeOf, starterFor } from "@akinaza/core";
import { migrateShopPage, parseShopPage, type ShopPage, type ShopPageIssue } from "@krizaka/ui/shop";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { Db } from "./client";
import { ShopError } from "./errors";
import { shopPage, shopPageVersions, shops } from "./schema";

/**
 * The shop page as a document (akinaza#400): one draft, one published (the page itself), the older ones archived. A write validates with
 * `parseShopPage` (after `migrateShopPage`, so an old schema is brought forward); every read does the same, so a stored document of an older
 * schema still renders. Every function takes the shop it works on: another shop's version is simply not found.
 */

/** How many archived versions a shop keeps (the oldest beyond are deleted on publish). @fixed: ADR-007 §6, history is bounded. */
export const SHOP_PAGE_ARCHIVE_KEEP = 20;

export class ShopPageInvalidError extends ShopError {
  constructor(readonly issues: ShopPageIssue[]) {
    super("AK_SHOP_PAGE_INVALID", issues.map((i) => `${i.path}: ${i.message}`).join("; "));
  }
}

/** A document as the page reads it: brought to the current schema, then validated. Throws `ShopPageInvalidError` (the 422's issues, with their paths). */
export function readShopPage(input: unknown): ShopPage {
  const migrated = migrateShopPage(input);
  if (!migrated.ok) throw new ShopPageInvalidError([{ path: "schema", message: migrated.reason }]);
  const parsed = parseShopPage(migrated.doc);
  if (!parsed.ok) throw new ShopPageInvalidError(parsed.issues);
  return parsed.page;
}

export interface ShopPageVersionRow {
  id: string;
  version: number;
  status: "draft" | "published" | "archived";
  authorId: string | null;
  createdAt: Date;
  publishedAt: Date | null;
}
const listColumns = { id: shopPageVersions.id, version: shopPageVersions.version, status: shopPageVersions.status, authorId: shopPageVersions.authorId, createdAt: shopPageVersions.createdAt, publishedAt: shopPageVersions.publishedAt };

async function tradeOf(db: Db, shopId: string): Promise<ReturnType<typeof shopTypeOf>> {
  const [row] = await db.select({ businessType: shops.businessType, shopType: shopPage.shopType }).from(shops).leftJoin(shopPage, eq(shopPage.shopId, shops.id)).where(eq(shops.id, shopId));
  if (!row) throw new ShopError("AK_NOT_FOUND");
  return shopTypeOf(row.businessType, row.shopType);
}

async function documentOf(db: Db, shopId: string, status: "draft" | "published") {
  const [row] = await db.select().from(shopPageVersions).where(and(eq(shopPageVersions.shopId, shopId), eq(shopPageVersions.status, status)));
  return row;
}

/** The public page's document: the published one, or (a shop that never saved a page) its trade's starter. Nothing is written on a read. */
export async function publishedShopPage(db: Db, shopId: string): Promise<{ page: ShopPage; version: number | null }> {
  const row = await documentOf(db, shopId, "published");
  if (row) return { page: readShopPage(row.doc), version: row.version };
  return { page: starterFor(await tradeOf(db, shopId)), version: null };
}

/** The composer's document: the draft, else what is published. `draft` says whether it differs from the page. */
export async function draftShopPage(db: Db, shopId: string): Promise<{ page: ShopPage; version: number | null; draft: boolean }> {
  const draft = await documentOf(db, shopId, "draft");
  if (draft) return { page: readShopPage(draft.doc), version: draft.version, draft: true };
  return { ...(await publishedShopPage(db, shopId)), draft: false };
}

async function maxVersion(db: Db, shopId: string): Promise<number> {
  const [row] = await db.select({ v: sql<number>`COALESCE(max(${shopPageVersions.version}), 0)::int` }).from(shopPageVersions).where(eq(shopPageVersions.shopId, shopId));
  return row?.v ?? 0;
}

/** Saves the draft (one per shop: a second save replaces it). The document is validated first. */
export async function saveShopPageDraft(db: Db, shopId: string, input: unknown, authorId: string | null): Promise<{ version: number }> {
  const page = readShopPage(input);
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`shop_page:${shopId}`}, 0))`);
    const existing = await documentOf(tx as unknown as Db, shopId, "draft");
    if (existing) {
      await tx.update(shopPageVersions).set({ doc: page, schema: page.schema, authorId, createdAt: sql`now()` }).where(eq(shopPageVersions.id, existing.id));
      return { version: existing.version };
    }
    const version = (await maxVersion(tx as unknown as Db, shopId)) + 1;
    await tx.insert(shopPageVersions).values({ shopId, version, status: "draft", schema: page.schema, doc: page, authorId });
    return { version };
  });
}

/** Makes the draft the page: the published one is archived, the draft becomes the published one (a fresh number), the archive is bounded. 409 without a draft. */
export async function publishShopPageDraft(db: Db, shopId: string, authorId: string | null): Promise<{ version: number }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`shop_page:${shopId}`}, 0))`);
    const draft = await documentOf(tx as unknown as Db, shopId, "draft");
    if (!draft) throw new ShopError("AK_SHOP_PAGE_NO_DRAFT");
    readShopPage(draft.doc);
    await tx.update(shopPageVersions).set({ status: "archived" }).where(and(eq(shopPageVersions.shopId, shopId), eq(shopPageVersions.status, "published")));
    const version = (await maxVersion(tx as unknown as Db, shopId)) + 1;
    await tx.update(shopPageVersions).set({ status: "published", version, authorId, publishedAt: sql`now()` }).where(eq(shopPageVersions.id, draft.id));
    await pruneArchive(tx as unknown as Db, shopId);
    return { version };
  });
}

/** Puts an archived version back as a NEW published version (history is never rewritten). 404 for a version that is not this shop's archive. */
export async function rollbackShopPage(db: Db, shopId: string, version: number, authorId: string | null, options: { keepDraft?: boolean } = {}): Promise<{ version: number; draftReset: boolean }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`shop_page:${shopId}`}, 0))`);
    const [target] = await tx.select().from(shopPageVersions).where(and(eq(shopPageVersions.shopId, shopId), eq(shopPageVersions.version, version), eq(shopPageVersions.status, "archived")));
    if (!target) throw new ShopError("AK_NOT_FOUND");
    const page = readShopPage(target.doc);
    const next = (await maxVersion(tx as unknown as Db, shopId)) + 1;
    await tx.update(shopPageVersions).set({ status: "archived" }).where(and(eq(shopPageVersions.shopId, shopId), eq(shopPageVersions.status, "published")));
    await tx.insert(shopPageVersions).values({ shopId, version: next, status: "published", schema: page.schema, doc: page, authorId, publishedAt: sql`now()` });
    await pruneArchive(tx as unknown as Db, shopId);
    // The draft is what the owner was editing BEFORE the restore: unless asked to keep it, it goes, so the composer shows the restored page.
    const draftReset = options.keepDraft ? false : (await tx.delete(shopPageVersions).where(and(eq(shopPageVersions.shopId, shopId), eq(shopPageVersions.status, "draft"))).returning({ id: shopPageVersions.id })).length > 0;
    return { version: next, draftReset };
  });
}

/** Throws the draft away: the composer then shows the published page again. Nothing to discard is not an error (`discarded: false`). */
export async function discardShopPageDraft(db: Db, shopId: string): Promise<{ discarded: boolean }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`shop_page:${shopId}`}, 0))`);
    const gone = await tx.delete(shopPageVersions).where(and(eq(shopPageVersions.shopId, shopId), eq(shopPageVersions.status, "draft"))).returning({ id: shopPageVersions.id });
    return { discarded: gone.length > 0 };
  });
}

async function pruneArchive(db: Db, shopId: string): Promise<void> {
  const old = await db.select({ id: shopPageVersions.id }).from(shopPageVersions).where(and(eq(shopPageVersions.shopId, shopId), eq(shopPageVersions.status, "archived"))).orderBy(desc(shopPageVersions.version)).offset(SHOP_PAGE_ARCHIVE_KEEP);
  if (old.length) await db.delete(shopPageVersions).where(inArray(shopPageVersions.id, old.map((r) => r.id)));
}

/** The shop's versions, newest first (the history the composer lists). */
export async function shopPageVersionsOf(db: Db, shopId: string): Promise<ShopPageVersionRow[]> {
  return db.select(listColumns).from(shopPageVersions).where(eq(shopPageVersions.shopId, shopId)).orderBy(desc(shopPageVersions.version));
}

/** The paper under the page, set by the template the owner applied (akinaza#305), or null (the look's own). */
export async function shopPaperOf(db: Db, shopId: string): Promise<FramePaper | null> {
  const [row] = await db.select({ paper: shopPage.paper }).from(shopPage).where(eq(shopPage.shopId, shopId));
  return row?.paper ?? null;
}

/** The accent the owner chose within the look, or null (the look's own). */
export async function shopAccentOf(db: Db, shopId: string): Promise<string | null> {
  const [row] = await db.select({ accent: shopPage.accent }).from(shopPage).where(eq(shopPage.shopId, shopId));
  return row?.accent ?? null;
}

/** Stores the accent (the caller checked it against the look's tested accents); creates the shop's page row when it has none. */
export async function setShopAccent(db: Db, shopId: string, accent: string | null): Promise<void> {
  await db.insert(shopPage).values({ shopId, accent }).onConflictDoUpdate({ target: shopPage.shopId, set: { accent, updatedAt: sql`now()` } });
}
