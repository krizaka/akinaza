import { addDayOff } from "@akinaza/db";
import { z } from "zod";

import { requireShop } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => {
    const { shop } = await requireShop(req, "schedule");
    const { day, reason } = await readJson(req, z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reason: z.string().trim().max(120).optional() }));
    await addDayOff(db(), shop.id, day, reason);
    return Response.json({ ok: true }, { status: 201 });
  });
}
