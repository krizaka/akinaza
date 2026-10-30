import { REEL_TRANSITIONS } from "@akinaza/core";
import { reorderReels, setReelTransition } from "@akinaza/db";
import { z } from "zod";

import { requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { assertShopFeature } from "@/lib/community";
import { db } from "@/lib/db";
import { handle, readJson, refuse } from "@/lib/http";
import { announcePage } from "@/lib/realtime";

export const dynamic = "force-dynamic";

const body = z.object({ order: z.array(z.string().uuid()).max(12).optional(), transition: z.enum(REEL_TRANSITIONS).optional() }).refine((b) => b.order !== undefined || b.transition !== undefined, { message: "Nothing to change" });

/**
 * The playlist of the shop's television (akinaza#469): the order of the videos (exactly the shop's own, each once - anything else is a 409 and changes
 * nothing) and the transition between two of them, one of three. Then the open pages draw themselves again.
 */
export function PUT(req: Request) {
  return handle(async () => {
    const { session, shop } = await requireShop(req, "catalogue");
    await assertShopFeature("features.shopReels");
    const { order, transition } = await readJson(req, body);
    if (order && !(await reorderReels(db(), shop.id, order))) {
      throw refuse(409, "REEL_ORDER", "The order must list this shop's videos, each once");
    }
    if (transition) {
      await setReelTransition(db(), shop.id, transition);
    }
    await audit({ action: "shop.reel_playlist_changed", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: { reordered: Boolean(order), transition: transition ?? null }, headers: req.headers });
    await announcePage(shop.id);
    return Response.json({ ok: true });
  });
}
