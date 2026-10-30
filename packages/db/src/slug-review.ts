import { holdSlug, type ProtectedTerm } from "@akinaza/core";
import { and, asc, eq, isNotNull, isNull, ne, or, sql } from "drizzle-orm";

import type { Db } from "./client";
import { accounts, shops } from "./schema";

/**
 * The administrator's review of held shop addresses (ADR-005 slice 4, akinaza#537): the queue, the two decisions (clear, or keep held with a reason),
 * and the one-off re-judging of the shops that existed before the hold did (dry run first, then apply).
 */

export interface HeldShop {
  shopId: string;
  name: string;
  slug: string;
  /** The term that matched, as the verdict named it. */
  term: string | null;
  heldAt: Date | null;
  ownerId: string | null;
  ownerEmail: string | null;
  published: boolean;
  /** Why an administrator kept the hold (the owner is not shown it), and when it was last looked at. */
  note: string | null;
  reviewedAt: Date | null;
}

/** The shops whose address is held for review, oldest first: what the administrator's queue lists. */
export async function heldShops(db: Db): Promise<HeldShop[]> {
  const rows = await db
    .select({ shopId: shops.id, name: shops.name, slug: shops.slug, term: shops.slugHeldTerm, heldAt: shops.slugHeldAt, ownerId: shops.ownerId, ownerEmail: accounts.email, published: shops.published, note: shops.slugHoldNote, reviewedAt: shops.slugHoldReviewedAt })
    .from(shops)
    .leftJoin(accounts, eq(accounts.id, shops.ownerId))
    .where(eq(shops.slugHeld, true))
    .orderBy(asc(shops.slugHeldAt), asc(shops.id));
  return rows.map((row) => ({ ...row, slug: row.slug! }));
}

/** The administrator clears a held address: the shop is public again (when published), and a re-judge will not hold this address again. False when the shop was not held. */
export async function clearSlugHold(db: Db, shopId: string): Promise<boolean> {
  const cleared = await db
    .update(shops)
    .set({ slugClearedFor: sql`${shops.slug}`, slugHeld: false, slugHeldTerm: null, slugHeldAt: null, slugHoldNote: null, slugHoldReviewedAt: sql`now()` })
    .where(and(eq(shops.id, shopId), eq(shops.slugHeld, true)))
    .returning({ id: shops.id });
  return cleared.length > 0;
}

/** The administrator reviews a held address and keeps it held, saying why (kept in the queue and in the audit). False when the shop is not held. */
export async function keepSlugHold(db: Db, shopId: string, reason: string): Promise<boolean> {
  const kept = await db
    .update(shops)
    .set({ slugHoldNote: reason.trim(), slugHoldReviewedAt: sql`now()` })
    .where(and(eq(shops.id, shopId), eq(shops.slugHeld, true)))
    .returning({ id: shops.id });
  return kept.length > 0;
}

export interface Rejudged {
  shopId: string;
  name: string;
  slug: string;
  matched: string;
  ownerId: string | null;
  ownerEmail: string | null;
  ownerLocale: "en" | "fr";
}

/**
 * Re-judges every shop that has an address and is not held against the current terms (the shops created before the hold existed, and any a term added
 * since would catch). An address an administrator already cleared is left alone. Without `apply` it only reports (the dry run); with it the shops are
 * held, in one statement per shop and only if still unheld, and the ones really held are returned (the caller notifies their owners).
 */
export async function rejudgeShops(db: Db, terms: readonly ProtectedTerm[], options: { apply: boolean }): Promise<Rejudged[]> {
  const rows = await db
    .select({ shopId: shops.id, name: shops.name, slug: shops.slug, ownerId: shops.ownerId, ownerEmail: accounts.email, ownerLocale: accounts.locale })
    .from(shops)
    .leftJoin(accounts, eq(accounts.id, shops.ownerId))
    .where(and(eq(shops.slugHeld, false), isNotNull(shops.slug), or(isNull(shops.slugClearedFor), ne(shops.slugClearedFor, shops.slug))))
    .orderBy(asc(shops.createdAt), asc(shops.id));
  const found: Rejudged[] = [];
  for (const row of rows) {
    const verdict = holdSlug(row.slug!, terms);
    if (verdict.held) found.push({ ...row, slug: row.slug!, matched: verdict.matched, ownerLocale: row.ownerLocale ?? "fr" });
  }
  if (!options.apply) return found;
  const applied: Rejudged[] = [];
  for (const shop of found) {
    const held = await db
      .update(shops)
      .set({ slugHeld: true, slugHeldTerm: shop.matched, slugHeldAt: sql`now()` })
      .where(and(eq(shops.id, shop.shopId), eq(shops.slugHeld, false), eq(shops.slug, shop.slug)))
      .returning({ id: shops.id });
    if (held.length > 0) applied.push(shop);
  }
  return applied;
}
