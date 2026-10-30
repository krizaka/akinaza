import { z } from "zod";

import { requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { BriefActionError, inviteRegulars } from "@/lib/brief";
import { mailSettings } from "@/lib/env";
import { handle, readJson, refuse } from "@/lib/http";
import { limit } from "@/lib/rate-limit";
import { requestNow } from "@/app/request-now";

export const dynamic = "force-dynamic";

const STATUS = { BRIEF_UNKNOWN: 404, BRIEF_DONE: 409, SHOP_NOT_PUBLIC: 409 } as const;

/** Invites this week's regulars (the gaps card): once per week, consent read again, every mail through the outbox. */
export function POST(req: Request) {
  return handle(async () => {
    const { session, shop } = await requireShop(req, "reports");
    limit("walker-brief-invite", req, session.account.id, [10, 600]);
    const { id } = await readJson(req, z.object({ id: z.string().regex(/^\d{4}-W\d{2}:[a-z]+:[A-Za-z0-9-]+$/) }));
    try {
      const result = await inviteRegulars(shop, id, requestNow(), mailSettings());
      await audit({ action: "brief.invited", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: { recommendation: id, ...result }, headers: req.headers });
      return Response.json(result);
    } catch (error) {
      if (error instanceof BriefActionError) throw refuse(STATUS[error.code], error.code, error.code);
      throw error;
    }
  });
}
