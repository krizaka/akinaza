import { CONSENT_TEXT_VERSION, eraseClient } from "@akinaza/db";
import { z } from "zod";

import { requireOwnClient } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle, readJson, refuse } from "@/lib/http";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const body = z.object({ clientId: z.string().uuid(), confirmEmail: z.string().trim().toLowerCase() });

/** Loi 25, erasure: the shop's file on this person is blanked (invoices kept as the law requires). The typed e-mail must match. */
export function POST(req: Request) {
  return handle(async () => {
    const input = await readJson(req, body);
    const { session, client } = await requireOwnClient(req, input.clientId);
    if (input.confirmEmail !== session.account.email) throw refuse(409, "CONFIRM_MISMATCH", "The e-mail typed does not match the account");
    limit("erase", req, session.account.id, [10, 3600]);
    await eraseClient(db(), client.id, CONSENT_TEXT_VERSION);
    await audit({ action: "client.erased", actorId: session.account.id, actorLabel: session.account.email, targetId: client.id, headers: req.headers });
    return Response.json({ ok: true });
  });
}
