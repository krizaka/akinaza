import { requireOwner } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { mailSettings } from "@/lib/env";
import { handle, idParam } from "@/lib/http";
import { sendWalkReport } from "@/lib/mail";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Sends the report to the dog's owner by e-mail (a fresh private link; the earlier one stops working). */
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { session, shop } = await requireOwner(req);
    limit("walker-report-send", req, session.account.id, [60, 600]);
    const bookingId = idParam((await params).id);
    const result = await sendWalkReport(db(), shop.id, bookingId, new Date(), mailSettings());
    await audit({ action: "report.sent", actorId: session.account.id, actorLabel: session.account.email, targetId: result.reportId, detail: { mail: result.status }, headers: req.headers });
    return Response.json(result);
  });
}
