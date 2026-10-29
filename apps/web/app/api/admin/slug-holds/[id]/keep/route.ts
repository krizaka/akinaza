import { keepSlugHold } from "@akinaza/db";
import { z } from "zod";

import { requireAdmin } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle, idParam, readJson, refuse } from "@/lib/http";

export const dynamic = "force-dynamic";

const body = z.object({ reason: z.string().trim().min(1).max(500) });

/** Reviews a held address and keeps it held, with the reason (shown in the queue, written to the audit). 404 when the shop is not held. */
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin(req);
    const shopId = idParam((await params).id);
    const { reason } = await readJson(req, body);
    if (!(await keepSlugHold(db(), shopId, reason))) throw refuse(404, "NOT_FOUND", "This shop is not held");
    await audit({ action: "shop.slug_hold_kept", actorId: admin.account.id, actorLabel: admin.account.email, targetId: shopId, detail: { reason }, headers: req.headers });
    return Response.json({ ok: true });
  });
}
