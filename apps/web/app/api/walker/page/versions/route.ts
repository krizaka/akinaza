import { shopPageVersionsOf } from "@akinaza/db";

import { requireShop } from "@/lib/access";
import { db } from "@/lib/db";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The history of the page, newest first: the draft, the published version, the archive. */
export function GET(req: Request) {
  return handle(async () => {
    const { shop } = await requireShop(req, "agenda");
    return Response.json({ versions: await shopPageVersionsOf(db(), shop.id) });
  });
}
