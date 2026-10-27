import { shopDay } from "@akinaza/db";

import { requireShop } from "@/lib/access";
import { db } from "@/lib/db";
import { loadFigures } from "@/lib/figures";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * The owner's figures for the apps (#260): each with its value, formula as data, sources, state and freshness, and « que faire maintenant ».
 * Computed from the ledger and the shop's rows; the thresholds are the administrator's. For who may read the reports.
 */
export function GET(req: Request) {
  return handle(async () => {
    const { shop } = await requireShop(req, "reports");
    const now = new Date();
    const { figures, actions, period } = await loadFigures(shop, await shopDay(db(), shop.id, now), now);
    return Response.json({ period, figures, actions }, { headers: { "Cache-Control": "private, no-store" } });
  });
}
