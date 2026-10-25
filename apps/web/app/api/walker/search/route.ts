import { searchShop } from "@akinaza/db";

import { requireShop } from "@/lib/access";
import { db } from "@/lib/db";
import { handle } from "@/lib/http";
import { may } from "@/lib/shop-permissions";

export const dynamic = "force-dynamic";

// @fixed: a name or a number, never a paragraph
const MAX_QUERY = 80;

/**
 * The palette's search (⌘K): the shop's client files and invoices matching `q`, each kind only for a role that may open it. The
 * shop is the guard's (`?shopId=` of another shop is a 404, like any resource of it).
 */
export function GET(req: Request) {
  return handle(async () => {
    const { shop, role } = await requireShop(req, "agenda");
    const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, MAX_QUERY);
    const found = await searchShop(db(), shop.id, q);
    return Response.json(
      { clients: may(role, "clients") ? found.clients : [], invoices: may(role, "invoices") ? found.invoices : [] },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  });
}
