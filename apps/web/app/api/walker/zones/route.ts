import { addZone, zonePlaceSchema } from "@akinaza/db";
import { z } from "zod";

import { requireOwner } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => {
    const { shop } = await requireOwner(req);
    const { name, place } = await readJson(req, z.object({ name: z.string().trim().min(1).max(80), place: zonePlaceSchema.optional() }));
    return Response.json({ id: await addZone(db(), shop.id, name, place) }, { status: 201 });
  });
}
