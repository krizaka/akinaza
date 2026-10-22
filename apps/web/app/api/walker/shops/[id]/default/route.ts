import { setDefaultShop } from "@akinaza/db";

import { requireSession } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, idParam } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The shop the app opens on: one of the owner's (404 for any other). */
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireSession(req);
    await setDefaultShop(db(), session.account.id, idParam((await params).id));
    return Response.json({ ok: true });
  });
}
