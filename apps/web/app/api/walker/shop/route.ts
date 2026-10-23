import { loadShop, saveShopPage, shopPageSchema } from "@akinaza/db";

import { requireSession, requireShop } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, idParam, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The walker creates or updates the shop page (address, taglines, published): the default shop, or `?shopId=` (another of theirs). */
export function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    const input = await readJson(req, shopPageSchema);
    const shopId = new URL(req.url).searchParams.get("shopId");
    return Response.json(await saveShopPage(db(), session.account.id, input, shopId ? { shopId: idParam(shopId) } : {}));
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
