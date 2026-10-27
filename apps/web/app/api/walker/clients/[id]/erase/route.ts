import { z } from "zod";

import { audit } from "@/lib/audit";
import { clientPrivacyRoute } from "@/lib/client-privacy-route";
import { eraseClientEverywhere } from "@/lib/client-requests";
import { readJson } from "@/lib/http";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const body = z.object({ confirm: z.literal(true) });

/**
 * Loi 25, erasure answered by the shop (akinaza#370): the file, the dependants, the notes, the reports and their photos are erased and
 * the live consents withdrawn; the invoices and the tax ledger stay for six years, as tax law requires. Owner only; written to the audit log.
 */
export const POST = clientPrivacyRoute(async ({ req, session, client }) => {
  await readJson(req, body);
  limit("client-erase", req, session.account.id, [20, 3600]);
  const erased = await eraseClientEverywhere(client.id);
  await audit({ action: "client.erased_by_shop", actorId: session.account.id, actorLabel: session.account.email, targetId: client.id, headers: req.headers });
  return Response.json({ ok: true, erased }, { headers: { "Cache-Control": "no-store" } });
});
