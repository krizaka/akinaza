import { exportClient } from "@akinaza/db";

import { requireShopClient } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { dataKey } from "@/lib/env";
import { handle, idParam } from "@/lib/http";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Loi 25, right of access answered by the shop: everything held about one client file, as one JSON document (akinaza#370). Owner only; written to the audit log. */
export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { session, client } = await requireShopClient(req, idParam((await params).id), "privacy");
    limit("client-export", req, session.account.id, [20, 3600]);
    const document = await exportClient(db(), dataKey(), client.id);
    await audit({ action: "client.exported_by_shop", actorId: session.account.id, actorLabel: session.account.email, targetId: client.id, headers: req.headers });
    return new Response(JSON.stringify(document, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="akinaza-client-data.json"', "Cache-Control": "no-store" } });
  });
}
