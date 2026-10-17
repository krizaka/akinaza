import { checkOut } from "@akinaza/db";

import { requireOwner } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, idParam } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The walker ends the walk: it is done, and its reports can be written. */
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { shop } = await requireOwner(req);
    const at = new Date();
    const { minutes } = await checkOut(db(), shop.id, idParam((await params).id), at);
    return Response.json({ checkedOutAt: at.toISOString(), minutes });
  });
}
