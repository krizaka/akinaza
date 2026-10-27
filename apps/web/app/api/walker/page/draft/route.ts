import { draftShopPage, saveShopPageDraft, shopAccentOf } from "@akinaza/db";
import { z } from "zod";

import { requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The composer's document: the draft, else the published page (else the trade's starter). Read with the agenda. */
export function GET(req: Request) {
  return handle(async () => {
    const { shop } = await requireShop(req, "agenda");
    return Response.json({ ...(await draftShopPage(db(), shop.id)), accent: await shopAccentOf(db(), shop.id) });
  });
}

/** Saves the draft (the whole document; one draft per shop). `parseShopPage` refuses it with a 422 and the path of each issue. Owner and manager. */
export function PUT(req: Request) {
  return handle(async () => {
    const { session, shop } = await requireShop(req, "catalogue");
    const doc = await readJson(req, z.record(z.string(), z.unknown()));
    const { version } = await saveShopPageDraft(db(), shop.id, doc, session.account.id);
    await audit({ action: "shop.page_draft_saved", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: { version }, headers: req.headers });
    return Response.json({ version });
  });
}
