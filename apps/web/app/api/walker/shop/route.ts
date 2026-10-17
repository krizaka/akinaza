import { saveShopPage, shopPageSchema } from "@akinaza/db";

import { requireSession } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The walker creates or updates the shop page (address, taglines, published). One shop per account. */
export function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    const input = await readJson(req, shopPageSchema);
    return Response.json(await saveShopPage(db(), session.account.id, input));
  });
}
