import { saveShopPage, shopPageSchema, shopsOfOwner } from "@akinaza/db";

import { requireSession } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** The owner's shops, the default one first (the one the app opens on). */
export function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    return Response.json({ shops: await shopsOfOwner(db(), session.account.id) });
  });
}

/** Adds another shop to the owner (the first one is made by `POST /api/walker/shop`); it is never the default until the owner says so. */
export function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    limit("shops", req, session.account.id, [20, 3600]);
    const input = await readJson(req, shopPageSchema);
    return Response.json(await saveShopPage(db(), session.account.id, input, { additional: true }), { status: 201 });
  });
}
