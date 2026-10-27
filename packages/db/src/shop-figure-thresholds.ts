import { type OwnerOverrides, parseOwnerOverrides } from "@akinaza/core";
import { eq, sql } from "drizzle-orm";

import type { Db } from "./client";
import { shopFigureRules } from "./schema";

/** The thresholds the owner changed for their shop (#260); `{}` when they never did. Whatever the row holds is read through the bounds again. */
export async function shopFigureOverrides(db: Db, shopId: string): Promise<OwnerOverrides> {
  const [row] = await db.select({ overrides: shopFigureRules.overrides }).from(shopFigureRules).where(eq(shopFigureRules.shopId, shopId));
  return parseOwnerOverrides(row?.overrides);
}

/**
 * Keeps the owner's thresholds for the shop, replacing the previous ones. Only tunable whole numbers inside the bounds are kept; an empty
 * set removes the row (back to the administrator's defaults). Returns what was kept, so the caller can tell the owner what was refused.
 */
export async function saveShopFigureOverrides(db: Db, shopId: string, input: unknown): Promise<OwnerOverrides> {
  const kept = parseOwnerOverrides(input);
  if (Object.keys(kept).length === 0) {
    await db.delete(shopFigureRules).where(eq(shopFigureRules.shopId, shopId));
    return kept;
  }
  await db.insert(shopFigureRules).values({ shopId, overrides: kept }).onConflictDoUpdate({ target: shopFigureRules.shopId, set: { overrides: kept, updatedAt: sql`now()` } });
  return kept;
}
