import { requireOwnClient } from "@/lib/access";
import { bookAndAnnounce } from "@/lib/book-visit";
import { bookingRequest } from "@/lib/booking-request";
import { handle, readJson } from "@/lib/http";
import { asLocale } from "@/lib/i18n";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** The client books a service (for some of their dependants, where the shop has them) at a start time the shop offers. */
export function POST(req: Request) {
  return handle(async () => {
    const input = await readJson(req, bookingRequest);
    const { session, client } = await requireOwnClient(req, input.clientId);
    limit("book", req, session.account.id, [60, 600]);
    const result = await bookAndAnnounce({ clientId: client.id, shopId: client.shopId, serviceId: input.serviceId, zoneId: input.zoneId, dependantIds: input.dependantIds, startsAt: input.startsAt, staffId: input.staffId, receiptTo: { accountId: session.account.id, email: session.account.email, locale: asLocale(client.language) } });
    return Response.json(result, { status: 201 });
  });
}
