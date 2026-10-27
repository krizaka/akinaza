import { exportClient } from "@akinaza/db";

import { audit } from "@/lib/audit";
import { clientPrivacyRoute } from "@/lib/client-privacy-route";
import { db } from "@/lib/db";
import { dataKey } from "@/lib/env";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Loi 25, right of access answered by the shop: everything held about one client file, as one JSON document (akinaza#370). Owner only; written to the audit log. */
export const GET = clientPrivacyRoute(async ({ req, session, client }) => {
  limit("client-export", req, session.account.id, [20, 3600]);
  const document = await exportClient(db(), dataKey(), client.id);
  await audit({ action: "client.exported_by_shop", actorId: session.account.id, actorLabel: session.account.email, targetId: client.id, headers: req.headers });
  return new Response(JSON.stringify(document, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="akinaza-client-data.json"', "Cache-Control": "no-store" } });
});
