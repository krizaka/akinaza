import { z } from "zod";

import { requireAdmin } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { mailSettings } from "@/lib/env";
import { handle, readJson } from "@/lib/http";
import { rejudgeAndNotify } from "@/lib/slug-rejudge";

export const dynamic = "force-dynamic";

const body = z.object({ apply: z.boolean().default(false) });

/**
 * The one-off re-judging of the shops created before the hold existed, against the current terms. `apply: false` (the default) is the dry run: the
 * report only, nothing changes. `apply: true` holds them and e-mails each owner. Audited with the numbers.
 */
export function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin(req);
    const { apply } = await readJson(req, body);
    const report = await rejudgeAndNotify(db(), { apply, now: new Date(), settings: mailSettings() });
    if (apply) {await audit({ action: "shop.slug_rejudged", actorId: admin.account.id, actorLabel: admin.account.email, detail: { held: report.shops.length, notified: report.notified }, headers: req.headers });}
    return Response.json({ apply, ...report }, { headers: { "Cache-Control": "private, no-store" } });
  });
}
