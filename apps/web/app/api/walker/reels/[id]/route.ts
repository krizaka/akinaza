import { removeReel } from "@akinaza/db";

import { requireShop } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, idParam, refuse } from "@/lib/http";
import { announcePage } from "@/lib/realtime";

export const dynamic = "force-dynamic";

/** Takes a reel down. Another shop's reel is a 404, the answer of an id that exists nowhere. */
export function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { shop } = await requireShop(req, "catalogue");
    if (!(await removeReel(db(), shop.id, idParam((await params).id)))) throw refuse(404, "NOT_FOUND", "Not found");
    await announcePage(shop.id);
    return Response.json({ ok: true });
  });
}
