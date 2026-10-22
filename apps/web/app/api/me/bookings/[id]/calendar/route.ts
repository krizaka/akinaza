import { bookingDetail } from "@akinaza/db";

import { requireSession } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, idParam, refuse } from "@/lib/http";
import { buildIcs } from "@/lib/ics";

export const dynamic = "force-dynamic";

/** « Add to calendar »: the booking as an .ics file, for its own client only. */
export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { account } = await requireSession(req);
    const now = new Date();
    const booking = await bookingDetail(db(), account.id, idParam((await params).id), now);
    if (!booking) throw refuse(404, "NOT_FOUND", "Not found");
    const name = account.locale === "fr" ? booking.service.nameFr : booking.service.nameEn;
    const ics = buildIcs({ uid: booking.id, start: booking.startsAt, end: booking.endsAt, summary: `${name} — ${booking.shop.name}`, location: booking.shop.address, now });
    return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="akinaza-booking.ics"', "Cache-Control": "no-store" } });
  });
}
