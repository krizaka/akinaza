import { addWindow, windowInputSchema } from "@akinaza/db";

import { requireShop } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Adds a weekly window of availability. */
export function POST(req: Request) {
  return handle(async () => {
    const { shop } = await requireShop(req, "schedule");
    const input = await readJson(req, windowInputSchema);
    return Response.json({ id: await addWindow(db(), shop.id, input) }, { status: 201 });
  });
}
