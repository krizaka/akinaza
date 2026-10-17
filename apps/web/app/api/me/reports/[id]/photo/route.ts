import { reportPhoto } from "@akinaza/db";

import { requireOwnClient } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, idParam, refuse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The photo of one of the client's own reports (`?clientId=`). */
export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { client } = await requireOwnClient(req, idParam(new URL(req.url).searchParams.get("clientId") ?? ""));
    const photo = await reportPhoto(db(), { clientId: client.id, reportId: idParam((await params).id) });
    if (!photo) throw refuse(404, "NOT_FOUND", "Not found");
    return new Response(new Uint8Array(photo.bytes), { headers: { "Content-Type": `image/${photo.type}`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=300" } });
  });
}
