import { bookVisit, ownerOfShop } from "@akinaza/db";

import { systemClock } from "@/app/system-clock";
import { requireOwnClient } from "@/lib/access";
import { bookingRequest } from "@/lib/booking-request";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";
import { limit } from "@/lib/rate-limit";
import { announceSlots } from "@/lib/realtime";
import { emitWebhook } from "@/lib/webhooks";

export const dynamic = "force-dynamic";


/** The client books a service (for some of their dependants, where the shop has them) at a start time the shop offers. */
export function POST(req: Request) {
  return handle(async () => {
    const input = await readJson(req, bookingRequest);
    const { session, client } = await requireOwnClient(req, input.clientId);
    limit("book", req, session.account.id, [60, 600]);
    const result = await bookVisit(db(), { clientId: client.id, serviceId: input.serviceId, zoneId: input.zoneId, dependantIds: input.dependantIds, startsAt: new Date(input.startsAt), now: new Date(), staffId: input.staffId });
    await announceSlots(client.shopId);
    await emitWebhook(await ownerOfShop(db(), client.shopId), { id: `appointment:${result.appointmentId}`, type: "booking.created", payload: { appointmentId: result.appointmentId, bookingIds: result.bookingIds, shopId: client.shopId, clientId: client.id, serviceId: input.serviceId, startsAt: new Date(input.startsAt).toISOString() } }, systemClock.now());
    return Response.json(result, { status: 201 });
  });
}
