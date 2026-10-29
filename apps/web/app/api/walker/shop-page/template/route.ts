import { applyTemplate, shopPageConfigOf } from "@akinaza/db";
import { z } from "zod";

import { requireOwner } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle, readJson, refuse } from "@/lib/http";
import { templateCatalogue, templateRules } from "@/lib/template-rules";

export const dynamic = "force-dynamic";

const body = z.object({ templateId: z.string().regex(/^[a-z]+-[a-z]+$/), templateVersion: z.number().int().min(1).optional(), keepOrder: z.boolean().optional() });

/**
 * The owner applies a template (#261): only a template the administrator offers, only while the switch is on. The shop's section order is replaced by the template's unless
 * the owner says `keepOrder`; a page they customised answers 409 `SECTIONS_CUSTOM` until they choose. Texts, media and translations are never touched.
 */
export function POST(req: Request) {
  return handle(async () => {
    const { session, shop } = await requireOwner(req);
    const rules = await templateRules();
    if (!rules.enabled) throw refuse(403, "FEATURE_OFF", "This feature is switched off", { feature: "features.storefrontTemplates" });
    const input = await readJson(req, body);
    const template = await applyTemplate(db(), shop.id, { ...input, offered: rules.offered }, await templateCatalogue());
    await audit({ action: "shop.template_applied", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: { template: template.id, version: template.version, keepOrder: input.keepOrder ?? null }, headers: req.headers });
    return Response.json(await shopPageConfigOf(db(), shop.id));
  });
}
