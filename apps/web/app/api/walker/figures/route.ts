import { shopDay } from "@akinaza/db";

import { requireShop } from "@/lib/access";
import { db } from "@/lib/db";
import { loadFigures } from "@/lib/figures";
import { handle } from "@/lib/http";
import { requestNow } from "@/app/request-now";

export const dynamic = "force-dynamic";

/**
 * The owner's figures for the apps (#260): each with its value, formula as data, sources, state and freshness, and « que faire maintenant ».
 * `figures` is the list the apps read (`figuresAnswer`), not the record keyed by id the domain computes (#433). Computed from the ledger and the shop's rows; the thresholds are the administrator's. For who may read the reports.
 */
export function GET(req: Request) {
  return handle(async () => {
    const { shop } = await requireShop(req, "reports");
    const now = requestNow();
    const { figures, actions, period } = await loadFigures(shop, await shopDay(db(), shop.id, now), now);
    return Response.json({ period, figures: Object.values(figures), actions }, { headers: { "Cache-Control": "private, no-store" } });
  });
}
