import { wallOf, saveWall } from "@akinaza/db";

import { requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { assertShopFeature, communityLimits } from "@/lib/community";
import { db } from "@/lib/db";
import { handle } from "@/lib/http";
import { announcePage } from "@/lib/realtime";

export const dynamic = "force-dynamic";

/** The wall as the owner pinned it, and the bounds it is held to. The team reads it (the studio's preview). */
export function GET(req: Request) {
  return handle(async () => {
    const { shop } = await requireShop(req, "agenda");
    return Response.json({ ...(await wallOf(db(), shop.id)), limits: await communityLimits() });
  });
}

/** Replaces the whole wall (texture and items). Owner and manager; the bounds are checked here, on what was sent, and again by the database. */
export function PUT(req: Request) {
  return handle(async () => {
    const { session, shop } = await requireShop(req, "catalogue");
    await assertShopFeature("features.shopWall");
    const body: unknown = await req.json().catch(() => null);
    await saveWall(db(), shop.id, body, (await communityLimits()).wallItems);
    await audit({ action: "shop.wall_saved", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, headers: req.headers });
    await announcePage(shop.id);
    return Response.json(await wallOf(db(), shop.id));
  });
}
