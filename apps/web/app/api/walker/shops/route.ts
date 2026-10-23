import { saveShopPage, shopPageSchema, shopsOfOwner } from "@akinaza/db";

import { requireSession } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";
import { organize } from "@/lib/organize";
import { limit } from "@/lib/rate-limit";
import { appSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** The owner's shops, the default one first (the one the app opens on), each with its description, avatar, tags and collection. */
export function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    const shops = await shopsOfOwner(db(), session.account.id);
    const tags = await organize().tags.of(session.account.id, "shop", shops.map((s) => s.id));
    return Response.json({ shops: shops.map((s) => ({ ...s, tags: tags.get(s.id) ?? [] })) });
  });
}

/** Adds another shop to the owner (the first one is made by `POST /api/walker/shop`); it is never the default until the owner says so. */
export function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    limit("shops", req, session.account.id, [20, 3600]);
    const input = await readJson(req, shopPageSchema);
    return Response.json(await saveShopPage(db(), session.account.id, input, { additional: true, maxShops: await appSettings().get("limits.shopsPerOwner") }), { status: 201 });
  });
}
