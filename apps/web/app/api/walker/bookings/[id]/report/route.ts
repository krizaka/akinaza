import { saveReport } from "@akinaza/db";

import { requireShop } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, idParam, refuse } from "@/lib/http";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// @fixed: the photo column's bound (1.5 MB) — the phone shrinks the picture before sending; this refuses a body that did not.
const MAX_PHOTO_BYTES = 1_572_864;

/** The note and, optionally, the photo of one dog's walk (multipart: `note`, `photo`, `removePhoto`). */
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { session, shop } = await requireShop(req, "visit-reports");
    limit("walker-report", req, session.account.id, [60, 600]);
    const form = await req.formData().catch(() => null);
    if (!form) throw refuse(400, "BAD_REQUEST", "The body is not a form");
    const file = form.get("photo");
    let photo: { bytes: Buffer } | null | undefined;
    if (form.get("removePhoto") === "1") photo = null;
    else if (file instanceof File && file.size > 0) {
      if (file.size > MAX_PHOTO_BYTES) throw refuse(413, "PHOTO_TOO_LARGE", "The photo is too large");
      photo = { bytes: Buffer.from(await file.arrayBuffer()) };
    }
    const result = await saveReport(db(), { shopId: shop.id, bookingId: idParam((await params).id), note: String(form.get("note") ?? ""), photo });
    return Response.json(result, { status: result.created ? 201 : 200 });
  });
}
