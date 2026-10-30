import { pendingAssociations } from "@akinaza/db";

import { requireAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The association proofs waiting for a decision, oldest first: the administrator's queue. */
export const GET = (req: Request) =>
  handle(async () => {
    await requireAdmin(req);
    return Response.json({ pending: await pendingAssociations(db()) }, { headers: { "Cache-Control": "private, no-store" } });
  });
