import { removeWindow } from "@akinaza/db";

import { requireShop } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, idParam } from "@/lib/http";

export const dynamic = "force-dynamic";

export function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { shop } = await requireShop(req, "schedule");
    await removeWindow(db(), shop.id, idParam((await params).id));
    return Response.json({ ok: true });
  });
}
