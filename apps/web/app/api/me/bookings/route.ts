import { bookVisit } from "@akinaza/db";
import { z } from "zod";

import { requireOwnClient } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const body = z.object({
  clientId: z.string().uuid(),
  serviceId: z.string().uuid(),
  zoneId: z.string().uuid().nullable(),
  dependantIds: z.array(z.string().uuid()).min(1).max(50),
  startsAt: z.string().datetime(),
  staffId: z.string().uuid().nullish(),
});

/** The client books a service for some of their dogs at a start time the shop offers. */
export function POST(req: Request) {
  return handle(async () => {
    const input = await readJson(req, body);
    const { session, client } = await requireOwnClient(req, input.clientId);
    limit("book", req, session.account.id, [60, 600]);
    const result = await bookVisit(db(), { clientId: client.id, serviceId: input.serviceId, zoneId: input.zoneId, dependantIds: input.dependantIds, startsAt: new Date(input.startsAt), now: new Date(), staffId: input.staffId });
    return Response.json(result, { status: 201 });
  });
}
