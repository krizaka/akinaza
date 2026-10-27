import { claimDueConnections } from "@akinaza/db";
import { z } from "zod";

import { systemClock } from "@/app/system-clock";
import { agendaScope, requireShop } from "@/lib/access";
import { calendarOverview } from "@/lib/calendar/overview";
import { syncConnection, syncSettings } from "@/lib/calendar/sync";
import { db } from "@/lib/db";
import { dataKey } from "@/lib/env";
import { handle, refuse } from "@/lib/http";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** « Refresh now »: reads this calendar again, whatever its schedule. */
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = z.string().uuid().safeParse((await params).id);
    if (!id.success) throw refuse(404, "NOT_FOUND", "Not found");
    const { shop, role, session } = await requireShop(req, "agenda");
    limit("calendar-sync", req, session.account.id, [10, 60]);
    const overview = await calendarOverview(shop.id, agendaScope(role, session.account.id));
    if (!overview.connections.some((c) => c.id === id.data)) throw refuse(404, "NOT_FOUND", "Not found");
    const now = systemClock.now();
    const [claimed] = await claimDueConnections(db(), now, 1, 5, { shopId: shop.id, id: id.data });
    if (!claimed) throw refuse(404, "NOT_FOUND", "Not found");
    const outcome = await syncConnection(claimed, now, await syncSettings(), dataKey());
    return Response.json({ outcome }, { headers: { "Cache-Control": "private, no-store" } });
  });
}
