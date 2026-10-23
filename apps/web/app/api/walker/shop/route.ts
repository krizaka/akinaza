import { saveShopPage, shopPageSchema } from "@akinaza/db";

import { requireSession } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle, idParam, readJson, refuse } from "@/lib/http";
import { appSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * The walker creates or updates a shop page (address, taglines, published): the default shop, `?shopId=` (another of theirs), or `?additional=1`
 * to add one more shop to their account (bounded by the administrator's `limits.shopsPerOwner`; the first stays the default, the new one starts unpublished).
 */
export function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    const input = await readJson(req, shopPageSchema);
    const params = new URL(req.url).searchParams;
    const shopId = params.get("shopId");
    if (params.get("additional") === "1") {
      if (shopId) throw refuse(400, "BAD_REQUEST", "Either a shop or a new one");
      // The bound is the service's (saveShopPage counts and inserts under one lock): the route only says what it is.
      const created = await saveShopPage(db(), session.account.id, { ...input, published: false }, { additional: true, maxShops: await appSettings().get("limits.shopsPerOwner") });
      await audit({ action: "shop.added", actorId: session.account.id, actorLabel: session.account.email, targetId: created.shopId, headers: req.headers });
      return Response.json(created, { status: 201 });
    }
    return Response.json(await saveShopPage(db(), session.account.id, input, shopId ? { shopId: idParam(shopId) } : {}));
  });
}
