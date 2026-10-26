import { replyToReview, setReviewState } from "@akinaza/db";
import { z } from "zod";

import { requireShop } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, idParam, readJson, refuse } from "@/lib/http";
import { announcePage } from "@/lib/realtime";

export const dynamic = "force-dynamic";

/** The owner answers a review (`reply`) and/or hides it or shows it again (`state`). Another shop's review is a 404. */
export function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { shop } = await requireShop(req, "catalogue");
    const id = idParam((await params).id);
    const body = await readJson(req, z.object({ reply: z.string().max(1000).optional(), state: z.enum(["published", "hidden_by_owner"]).optional() }).refine((b) => b.reply !== undefined || b.state !== undefined));
    if (body.reply !== undefined && !(await replyToReview(db(), shop.id, id, body.reply))) throw refuse(404, "NOT_FOUND", "Not found");
    if (body.state !== undefined && !(await setReviewState(db(), shop.id, id, body.state))) throw refuse(404, "NOT_FOUND", "Not found");
    await announcePage(shop.id);
    return Response.json({ ok: true });
  });
}
