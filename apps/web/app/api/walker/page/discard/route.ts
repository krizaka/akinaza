import { discardShopPageDraft } from "@akinaza/db";

import { requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Throws the draft away: the composer shows the published page again. Owner and manager. Audited only when there was a draft. */
export function POST(req: Request) {
  return handle(async () => {
    const { session, shop } = await requireShop(req, "catalogue");
    const { discarded } = await discardShopPageDraft(db(), shop.id);
    if (discarded) await audit({ action: "shop.page_draft_discarded", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: {}, headers: req.headers });
    return Response.json({ discarded });
  });
}
