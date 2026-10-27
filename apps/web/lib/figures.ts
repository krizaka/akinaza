import { computeFigures, declarationPeriod, type Figure, type FigureId, FILING, type NextAction, nextActions, type Period } from "@akinaza/core";
import { figuresSnapshot } from "@akinaza/db";

import { db } from "./db";
import { figureRules } from "./figure-rules";

export interface ShopFigures {
  figures: Record<FigureId, Figure>;
  actions: NextAction[];
  period: Period;
}

/**
 * The owner's figures and « que faire maintenant » for a shop at an instant (#260): the ledger and the shop's rows read in its own calendar,
 * computed by `@akinaza/core`, judged by the administrator's thresholds. The period is the declaration period that contains `today` (or the
 * one asked for); the shop's filing frequency is not captured yet, so quarters, as « Vos livres » prepares them.
 */
export async function loadFigures(shop: { id: string }, today: string, now: Date, period?: Period): Promise<ShopFigures> {
  const range = period ?? declarationPeriod(today, FILING.quarterly);
  const { input, slots } = await figuresSnapshot(db(), shop.id, { today, computedAt: now.toISOString(), period: range });
  const { thresholds, offered } = await figureRules();
  return {
    figures: computeFigures(input, thresholds),
    // The return is prepared on demand from the ledger and never stored, so « prepare the return » stays offered while the period ends.
    actions: nextActions({ figures: input, returnPrepared: false, slots }, thresholds, offered),
    period: range,
  };
}
