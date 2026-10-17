import { joinInputSchema, joinShop } from "@akinaza/db";
import { z } from "zod";

import { requireSession } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const body = joinInputSchema.extend({ shopId: z.string().uuid() });

/** A signed-in person opens their client file at a shop: name, phone and the consents they chose (never pre-ticked). */
export function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    limit("join", req, session.account.id, [20, 600]);
    const { shopId, ...input } = await readJson(req, body);
    return Response.json(await joinShop(db(), session.account.id, session.account.email, shopId, input), { status: 201 });
  });
}
