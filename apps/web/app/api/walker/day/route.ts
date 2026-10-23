import { dayVisits, shopDay } from "@akinaza/db";

import { requireShop } from "@/lib/access";
import { dayParam, queryOf } from "@/lib/day-param";
import { db } from "@/lib/db";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The owner's day: `?date=2026-10-20`, today in the shop's time zone by default, its visits with who and what is booked on each. */
export function GET(req: Request) {
  return handle(async () => {
    const { shop } = await requireShop(req, "agenda");
    const asked = queryOf(req).date;
    const day = asked === undefined ? await shopDay(db(), shop.id, new Date()) : dayParam.parse(asked);
    return Response.json({ day, visits: await dayVisits(db(), shop.id, day) }, { headers: { "Cache-Control": "private, no-store" } });
  });
}
