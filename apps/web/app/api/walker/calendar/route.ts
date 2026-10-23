import { visitDays } from "@akinaza/db";

import { requireShop } from "@/lib/access";
import { calendarQuery, queryOf } from "@/lib/day-param";
import { db } from "@/lib/db";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The owner's calendar: `?from=2026-10-01&to=2026-10-31`, the visits and bookings of each day that has some. */
export function GET(req: Request) {
  return handle(async () => {
    const { shop } = await requireShop(req, "agenda");
    const { from, to } = calendarQuery.parse(queryOf(req));
    return Response.json({ days: await visitDays(db(), shop.id, from, to) }, { headers: { "Cache-Control": "private, no-store" } });
  });
}
