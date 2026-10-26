import { addExternalReel, reelsOf } from "@akinaza/db";
import { z } from "zod";

import { requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { assertShopFeature, communityLimits } from "@/lib/community";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";
import { announcePage } from "@/lib/realtime";

export const dynamic = "force-dynamic";

/** The shop's reels, newest first (the first is the one the page shows), and the bounds of an upload. */
export function GET(req: Request) {
  return handle(async () => {
    const { shop } = await requireShop(req, "agenda");
    const { reelSeconds, reelMegabytes } = await communityLimits();
    return Response.json({ reels: await reelsOf(db(), shop.id), limits: { reelSeconds, reelMegabytes } });
  });
}

/** A link to a TikTok, a YouTube Short or an Instagram reel. Nothing is fetched from the platform here, nor on the page before a click. */
export function POST(req: Request) {
  return handle(async () => {
    const { session, shop } = await requireShop(req, "catalogue");
    await assertShopFeature("features.shopReels");
    const { url, titleFr, titleEn } = await readJson(req, z.object({ url: z.string().max(300), titleFr: z.string().max(60).default(""), titleEn: z.string().max(60).default("") }));
    const id = await addExternalReel(db(), shop.id, url, { titleFr, titleEn });
    await audit({ action: "shop.reel_linked", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: { reel: id }, headers: req.headers });
    await announcePage(shop.id);
    return Response.json({ id }, { status: 201 });
  });
}
