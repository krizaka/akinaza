import { loadShop, saveShopPage, shopPageSchema } from "@akinaza/db";

import { requireSession, requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle, idParam, readJson, refuse } from "@/lib/http";
import { appSettings } from "@/lib/settings";
import { slugPolicy } from "@/lib/slug-policy";
import { forgetShops } from "@/lib/shop-directory";

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
      if (shopId) {throw refuse(400, "BAD_REQUEST", "Either a shop or a new one");}
      // The bound is the service's (saveShopPage counts and inserts under one lock): the route only says what it is.
      const created = await saveShopPage(db(), session.account.id, { ...input, published: false }, { additional: true, maxShops: await appSettings().get("limits.shopsPerOwner") }, await slugPolicy());
      await audit({ action: "shop.added", actorId: session.account.id, actorLabel: session.account.email, targetId: created.shopId, headers: req.headers });
      return Response.json(created, { status: 201 });
    }
    const saved = await saveShopPage(db(), session.account.id, input, shopId ? { shopId: idParam(shopId) } : {}, await slugPolicy());
    forgetShops(); // published, unpublished or renamed: the shop host answers from the database again (akinaza#549)
    return Response.json(saved);
  });
}

/** What an app needs of the owner's shop: who it is, its tax status and the services an invoice line can name. */
export function GET(req: Request) {
  return handle(async () => {
    const { shop } = await requireShop(req, "invoices");
    const setup = await loadShop(db(), shop);
    const { name, registrant, timezone, paymentTermsDays } = setup.shop;
    const services = setup.services.map((s) => ({ id: s.id, nameFr: s.nameFr, nameEn: s.nameEn, priceCents: s.priceCents, taxCategory: s.taxCategory }));
    return Response.json({ shop: { id: shop.id, name, registrant, timezone, paymentTermsDays }, services }, { headers: { "Cache-Control": "private, no-store" } });
  });
}
