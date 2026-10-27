import { publishShopPageDraft } from "@akinaza/db";

import { requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle } from "@/lib/http";
import { announcePage } from "@/lib/realtime";

export const dynamic = "force-dynamic";

/** Publishes the draft: it becomes the public page, the previous one is archived. 409 without a draft. Owner and manager. */
export function POST(req: Request) {
  return handle(async () => {
    const { session, shop } = await requireShop(req, "catalogue");
    const { version } = await publishShopPageDraft(db(), shop.id, session.account.id);
    await audit({ action: "shop.page_published", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: { version }, headers: req.headers });
    await announcePage(shop.id);
    return Response.json({ version });
  });
}
