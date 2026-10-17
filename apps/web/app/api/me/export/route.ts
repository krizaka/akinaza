import { exportClient } from "@akinaza/db";

import { requireOwnClient } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { dataKey } from "@/lib/env";
import { handle, idParam } from "@/lib/http";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Loi 25, right of access: everything a shop holds about the client, as one JSON file (`?clientId=`). */
export function GET(req: Request) {
  return handle(async () => {
    const { session, client } = await requireOwnClient(req, idParam(new URL(req.url).searchParams.get("clientId") ?? ""));
    limit("export", req, session.account.id, [10, 3600]);
    const data = await exportClient(db(), dataKey(), client.id);
    await audit({ action: "client.exported", actorId: session.account.id, actorLabel: session.account.email, targetId: client.id, headers: req.headers });
    return new Response(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="akinaza-my-data.json"', "Cache-Control": "no-store" } });
  });
}
