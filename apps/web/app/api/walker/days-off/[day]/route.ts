import { removeDayOff } from "@akinaza/db";
import { z } from "zod";

import { requireShop } from "@/lib/access";
import { db } from "@/lib/db";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

export function DELETE(req: Request, { params }: { params: Promise<{ day: string }> }) {
  return handle(async () => {
    const { shop } = await requireShop(req, "schedule");
    await removeDayOff(db(), shop.id, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse((await params).day));
    return Response.json({ ok: true });
  });
}
