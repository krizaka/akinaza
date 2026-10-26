import { SOCIAL_PLATFORMS } from "@akinaza/core";
import { saveSocialLinks, socialLinksOf } from "@akinaza/db";
import { z } from "zod";

import { requireShop } from "@/lib/access";
import { assertShopFeature } from "@/lib/community";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";
import { announcePage } from "@/lib/realtime";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => {
    const { shop } = await requireShop(req, "agenda");
    return Response.json({ links: await socialLinksOf(db(), shop.id) });
  });
}

/** Sets (an address) or removes (null) the shop's profile on a platform; a platform not named stays. The address must be on that platform's own host. */
export function PUT(req: Request) {
  return handle(async () => {
    const { shop } = await requireShop(req, "catalogue");
    await assertShopFeature("features.shopReels");
    const links = await readJson(req, z.object(Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p, z.string().max(300).nullable().optional()]))));
    await saveSocialLinks(db(), shop.id, Object.fromEntries(Object.entries(links).filter(([, v]) => v !== undefined)) as never);
    await announcePage(shop.id);
    return Response.json({ links: await socialLinksOf(db(), shop.id) });
  });
}
