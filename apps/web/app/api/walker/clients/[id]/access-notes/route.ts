import { revealAccessNotes } from "@akinaza/db";

import { requireShopClient } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { dataKey } from "@/lib/env";
import { handle, idParam } from "@/lib/http";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** The walker opens a client's access notes (keys, door codes) — one client at a time, written to the audit log. */
export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { session, client } = await requireShopClient(req, idParam((await params).id));
    limit("access-notes", req, session.account.id, [120, 600]);
    const notes = await revealAccessNotes(db(), dataKey(), client.id);
    await audit({ action: "client.access_notes_read", actorId: session.account.id, actorLabel: session.account.email, targetId: client.id, headers: req.headers });
    return Response.json({ notes }, { headers: { "Cache-Control": "no-store" } });
  });
}
