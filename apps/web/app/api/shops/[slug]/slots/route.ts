import { slugSchema } from "@akinaza/core";
import { listSlots, publicShop } from "@akinaza/db";
import { z } from "zod";

import { db } from "@/lib/db";
import { handle, refuse } from "@/lib/http";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const query = z.object({ serviceId: z.string().uuid(), zoneId: z.string().uuid().nullable(), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

/** The start times offered for a service in a zone (public: it is what the shop page shows). */
export function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    limit("slots", req, null, [120, 60]);
    const url = new URL(req.url);
    const parsed = query.safeParse({ serviceId: url.searchParams.get("serviceId"), zoneId: url.searchParams.get("zoneId") || null, from: url.searchParams.get("from") ?? undefined });
    if (!parsed.success) throw refuse(400, "BAD_REQUEST", "Invalid query");
    const page = await publicShop(db(), slugSchema.parse((await params).slug));
    if (!page) throw refuse(404, "NOT_FOUND", "Not found");
    const slots = await listSlots(db(), { shopId: page.shop.id, serviceId: parsed.data.serviceId, zoneId: parsed.data.zoneId, fromDay: parsed.data.from, days: 14, now: new Date() });
    return Response.json({ slots: slots.map((s) => ({ startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString(), seatsLeft: s.seatsLeft, capacity: s.capacity, joins: s.joins })) });
  });
}
