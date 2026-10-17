import { addZone } from "@akinaza/db";
import { z } from "zod";

import { requireOwner } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => {
    const { shop } = await requireOwner(req);
    const { name } = await readJson(req, z.object({ name: z.string().trim().min(1).max(80) }));
    return Response.json({ id: await addZone(db(), shop.id, name) }, { status: 201 });
  });
}
