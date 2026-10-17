import { shopRulesSchema } from "@akinaza/core";
import { saveRules } from "@akinaza/db";

import { requireOwner } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The shop's own rules (cancellation window, horizon, step, notice, report-link life): data, bounded. */
export function POST(req: Request) {
  return handle(async () => {
    const { session, shop } = await requireOwner(req);
    const rules = await readJson(req, shopRulesSchema);
    await saveRules(db(), shop.id, rules);
    await audit({ action: "shop.rules_changed", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: rules, headers: req.headers });
    return Response.json({ ok: true });
  });
}
