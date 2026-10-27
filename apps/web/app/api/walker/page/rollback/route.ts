import { rollbackShopPage } from "@akinaza/db";
import { z } from "zod";

import { requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";
import { announcePage } from "@/lib/realtime";

export const dynamic = "force-dynamic";

/** Puts an archived version back as a new published version (history is kept). 404 for a version that is not this shop's. Owner and manager. */
export function POST(req: Request) {
  return handle(async () => {
    const { session, shop } = await requireShop(req, "catalogue");
    const { version } = await readJson(req, z.object({ version: z.number().int().min(1) }));
    const restored = await rollbackShopPage(db(), shop.id, version, session.account.id);
    await audit({ action: "shop.page_rolled_back", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: { from: version, version: restored.version }, headers: req.headers });
    await announcePage(shop.id);
    return Response.json(restored);
  });
}
