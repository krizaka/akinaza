import { heldShops } from "@akinaza/db";

import { requireAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The shops whose address wears a protected term (brand, lure word, look-alike), oldest first: the administrator's review queue (ADR-005, #537). */
export const GET = (req: Request) =>
  handle(async () => {
    await requireAdmin(req);
    return Response.json({ held: await heldShops(db()) }, { headers: { "Cache-Control": "private, no-store" } });
  });
