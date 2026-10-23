import { visitDays } from "@akinaza/db";

import { agendaScope, requireShop } from "@/lib/access";
import { calendarQuery, queryOf } from "@/lib/day-param";
import { db } from "@/lib/db";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The shop's calendar (a staff member's own appointments only): `?from=2026-10-01&to=2026-10-31`, the visits and bookings of each day that has some. */
export function GET(req: Request) {
  return handle(async () => {
    const { shop, role, session } = await requireShop(req, "agenda");
    const { from, to } = calendarQuery.parse(queryOf(req));
    return Response.json({ days: await visitDays(db(), shop.id, from, to, agendaScope(role, session.account.id)) }, { headers: { "Cache-Control": "private, no-store" } });
  });
}
