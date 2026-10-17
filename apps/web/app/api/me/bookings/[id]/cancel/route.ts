import { cancelBooking } from "@akinaza/db";
import { z } from "zod";

import { requireOwnClient } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, idParam, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The client cancels a booking, until the shop's cancellation window before the walk. */
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { clientId } = await readJson(req, z.object({ clientId: z.string().uuid() }));
    const { client } = await requireOwnClient(req, clientId);
    await cancelBooking(db(), client.id, idParam((await params).id), new Date());
    return Response.json({ ok: true });
  });
}
