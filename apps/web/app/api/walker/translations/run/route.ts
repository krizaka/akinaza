import { translateShop } from "@akinaza/db";
import { localDay } from "@krizaka/intl";
import { z } from "zod";

import { requireOwner } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle, readJson, refuse } from "@/lib/http";
import { limit } from "@/lib/rate-limit";
import { translationPort } from "@/lib/translation";
import { translationRules } from "@/lib/translation-settings";

export const dynamic = "force-dynamic";

const body = z.object({ locale: z.enum(["fr", "en", "es"]), redo: z.array(z.string().max(120)).max(100).optional() });

/**
 * « Traduire »: one language of the page, through the Orazaka translation port. The administrator's switch and daily limit apply; a text the owner
 * edited is redone only when named in `redo` (« refaire la traduction »).
 */
export function POST(req: Request) {
  return handle(async () => {
    const { session, shop } = await requireOwner(req);
    limit("shop-translate", req, session.account.id, [30, 600]);
    const rules = await translationRules();
    if (!rules.enabled) throw refuse(403, "FEATURE_OFF", "This feature is switched off", { feature: "features.storefrontTranslation" });
    const input = await readJson(req, body);
    const result = await translateShop(db(), translationPort(), { shopId: shop.id, locale: input.locale, day: localDay(new Date(), shop.timezone), dailyLimit: rules.dailyLimit, redo: input.redo });
    await audit({ action: "shop.translated", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: { locale: input.locale, runId: result.runId, stored: result.stored.length, skippedEdited: result.skippedEdited.length }, headers: req.headers });
    return Response.json(result);
  });
}
