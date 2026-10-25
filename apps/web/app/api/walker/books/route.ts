import { prepareShopReturn, shopDay } from "@akinaza/db";

import { requireShop } from "@/lib/access";
import { booksView, periodChoices, periodFor } from "@/lib/books";
import { queryOf } from "@/lib/day-param";
import { db } from "@/lib/db";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * « Livres » for the apps (D8): the period's combined GST/QST return (`?period=2026-Q3` or `2026-02`, the latest completed quarter
 * by default), prepared from the ledger as the web's page prepares it. Prepared only: the merchant files it, Akinaza never does.
 */
export function GET(req: Request) {
  return handle(async () => {
    const { shop } = await requireShop(req, "reports");
    const today = await shopDay(db(), shop.id, new Date());
    const period = periodFor(queryOf(req).period, today);
    const view = booksView(await prepareShopReturn(db(), shop.id, period.start, period.end));
    return Response.json(
      { period: { id: period.id, start: period.start, end: period.end }, choices: periodChoices(today).map((p) => p.id), gst: view.gst, qst: view.qst, preparedOnly: view.preparedOnly },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  });
}
