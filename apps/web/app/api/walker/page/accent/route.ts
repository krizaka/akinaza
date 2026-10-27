import { draftShopPage, setShopAccent, ShopPageInvalidError } from "@akinaza/db";
import { z } from "zod";

import { requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";
import { announcePage } from "@/lib/realtime";
import { acceptedAccents } from "@/lib/shop-accents";

export const dynamic = "force-dynamic";

/** Stores the accent of the shop page (`null` = the look's own). 422 with the path `accent` for a value outside the look's list. Owner and manager. */
export function PUT(req: Request) {
  return handle(async () => {
    const { session, shop } = await requireShop(req, "catalogue");
    const { accent } = await readJson(req, z.object({ accent: z.string().max(40).nullable() }));
    if (accent !== null) {
      const { page } = await draftShopPage(db(), shop.id);
      if (!acceptedAccents(page.preset.id).includes(accent)) throw new ShopPageInvalidError([{ path: "accent", message: `not one of the accents of ${page.preset.id}` }]);
    }
    await setShopAccent(db(), shop.id, accent);
    await audit({ action: "shop.page_accent_set", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: { accent }, headers: req.headers });
    await announcePage(shop.id);
    return Response.json({ accent });
  });
}
