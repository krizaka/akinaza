import { reorderServices } from "@akinaza/db";
import { z } from "zod";

import { requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle, readJson, refuse } from "@/lib/http";
import { announcePage } from "@/lib/realtime";

export const dynamic = "force-dynamic";

const body = z.object({ order: z.array(z.string().uuid()).min(1).max(50) });

/**
 * The owner's order of the offers on the page (akinaza#597): exactly the shop's active offers, each once - anything else is a 409 and changes nothing.
 * Then the open pages draw themselves again.
 */
export function PUT(req: Request) {
  return handle(async () => {
    const { session, shop } = await requireShop(req, "catalogue");
    const { order } = await readJson(req, body);
    if (!(await reorderServices(db(), shop.id, order))) throw refuse(409, "SERVICE_ORDER", "The order must list this shop's offers, each once");
    await audit({ action: "shop.services_reordered", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: { count: order.length }, headers: req.headers });
    await announcePage(shop.id);
    return Response.json({ ok: true });
  });
}
