import { saveShopMedia, shopMediaInputSchema } from "@akinaza/db";

import { requireOwner } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The shop's cover and gallery (https addresses of files on the media CDN): replaced as a whole. */
export function POST(req: Request) {
  return handle(async () => {
    const { session, shop } = await requireOwner(req);
    const input = await readJson(req, shopMediaInputSchema);
    await saveShopMedia(db(), shop.id, input);
    await audit({ action: "shop.media_changed", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: { cover: Boolean(input.cover), gallery: input.gallery?.length ?? 0 }, headers: req.headers });
    return Response.json({ ok: true });
  });
}
