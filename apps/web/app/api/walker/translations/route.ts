import { saveShopLanguages, translationRunsOn } from "@akinaza/db";
import { translationRows } from "@akinaza/db";
import { localDay } from "@krizaka/intl";
import { z } from "zod";

import { requireOwner } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";
import { translationRules } from "@/lib/translation-settings";
import { requestNow } from "@/app/request-now";

export const dynamic = "force-dynamic";

const languagesBody = z.object({ source: z.enum(["fr", "en"]), enabled: z.array(z.enum(["fr", "en", "es"])).max(3) });

/** The shop page's languages and its texts with their translations: what the owner's screen draws, and what the administrator allows. */
export function GET(req: Request) {
  return handle(async () => {
    const { shop } = await requireOwner(req);
    const rules = await translationRules();
    const rows = await translationRows(db(), shop.id);
    const today = localDay(requestNow(), shop.timezone);
    return Response.json({ ...rows, allowed: rules.allowed, translationOn: rules.enabled, dailyLimit: rules.dailyLimit, usedToday: await translationRunsOn(db(), shop.id, today) }, { headers: { "Cache-Control": "private, no-store" } });
  });
}

/** The languages the owner turns on, inside the administrator's list; the source is always on. */
export function PUT(req: Request) {
  return handle(async () => {
    const { session, shop } = await requireOwner(req);
    const input = await readJson(req, languagesBody);
    const rules = await translationRules();
    const saved = await saveShopLanguages(db(), shop.id, input, rules.allowed);
    await audit({ action: "shop.languages_updated", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: { source: saved.source, enabled: saved.enabled }, headers: req.headers });
    return Response.json(saved);
  });
}
