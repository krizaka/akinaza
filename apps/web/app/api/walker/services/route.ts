import { saveService, serviceInputSchema } from "@akinaza/db";

import { requireOwner } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Creates or updates a service (name FR/EN, duration, price in cents, capacity, active). */
export function POST(req: Request) {
  return handle(async () => {
    const { shop } = await requireOwner(req);
    const input = await readJson(req, serviceInputSchema);
    return Response.json({ id: await saveService(db(), shop.id, input) }, { status: input.id ? 200 : 201 });
  });
}
