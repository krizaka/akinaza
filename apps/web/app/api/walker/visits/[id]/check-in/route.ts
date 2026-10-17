import { checkIn } from "@akinaza/db";

import { requireOwner } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, idParam } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The walker starts the walk (once). */
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { shop } = await requireOwner(req);
    const at = new Date();
    await checkIn(db(), shop.id, idParam((await params).id), at);
    return Response.json({ checkedInAt: at.toISOString() });
  });
}
