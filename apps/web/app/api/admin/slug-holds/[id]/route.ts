import { clearSlugHold } from "@akinaza/db";

import { requireAdmin } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle, idParam, refuse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Clears a held address after review: the shop is public again. 404 when the shop is not held. Audited. */
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin(req);
    const shopId = idParam((await params).id);
    if (!(await clearSlugHold(db(), shopId))) {throw refuse(404, "NOT_FOUND", "This shop is not held");}
    await audit({ action: "shop.slug_hold_cleared", actorId: admin.account.id, actorLabel: admin.account.email, targetId: shopId, headers: req.headers });
    return Response.json({ ok: true });
  });
}
