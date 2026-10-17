import { setAccessNotes } from "@akinaza/db";
import { z } from "zod";

import { requireOwnClient } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { dataKey } from "@/lib/env";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

const body = z.object({ clientId: z.string().uuid(), notes: z.string().trim().max(500).nullable() });

/** The client tells the walker how to get in (key, door code): sealed at rest; an empty text clears it. */
export function POST(req: Request) {
  return handle(async () => {
    const input = await readJson(req, body);
    const { session, client } = await requireOwnClient(req, input.clientId);
    await setAccessNotes(db(), dataKey(), client.id, input.notes);
    await audit({ action: "client.access_notes_set", actorId: session.account.id, actorLabel: session.account.email, targetId: client.id, headers: req.headers });
    return Response.json({ ok: true });
  });
}
