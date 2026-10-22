import { saveShopPage, shopPageSchema } from "@akinaza/db";

import { requireSession } from "@/lib/access";
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
