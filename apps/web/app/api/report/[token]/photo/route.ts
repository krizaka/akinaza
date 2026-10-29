import { reportPhoto } from "@akinaza/db";

import { db } from "@/lib/db";
import { handle, refuse } from "@/lib/http";
import { limit } from "@/lib/rate-limit";
import { requestNow } from "@/app/request-now";

export const dynamic = "force-dynamic";

/** The photo behind a report's private link, while the link lives. The token is the only credential. */
export function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    limit("report-photo", req, null, [60, 60]);
    const photo = await reportPhoto(db(), { token: (await params).token, now: requestNow() });
    if (!photo) throw refuse(404, "NOT_FOUND", "Not found");
    return new Response(new Uint8Array(photo.bytes), { headers: { "Content-Type": `image/${photo.type}`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=300" } });
  });
}
