import { shopClients } from "@akinaza/db";

import { requireShop } from "@/lib/access";
import { db } from "@/lib/db";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The owner's client files with their dependants (the access notes are revealed one client at a time, elsewhere). */
export function GET(req: Request) {
  return handle(async () => {
    const { shop } = await requireShop(req, "clients");
    return Response.json({ clients: await shopClients(db(), shop.id) }, { headers: { "Cache-Control": "private, no-store" } });
  });
}
