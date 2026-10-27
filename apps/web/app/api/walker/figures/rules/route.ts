import { OWNER_BOUNDS, OWNER_TUNABLE, parseOwnerOverrides } from "@akinaza/core";
import { saveShopFigureOverrides, shopFigureOverrides } from "@akinaza/db";
import { z } from "zod";

import { requireOwner } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { adminFigureRules } from "@/lib/figure-rules";
import { handle, readJson, refuse } from "@/lib/http";
import { appSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const body = z.object({ overrides: z.record(z.string(), z.unknown()) });

/** The thresholds in force for the shop: the administrator's defaults, the owner's own, the bounds, and whether tuning is open. Owner only. */
export function GET(req: Request) {
  return handle(async () => {
    const { shop } = await requireOwner(req);
    const [{ defaults }, tunable, overrides] = await Promise.all([adminFigureRules(), appSettings().get("figures.ownerTunable"), shopFigureOverrides(db(), shop.id)]);
    const pick = Object.fromEntries(OWNER_TUNABLE.map((key) => [key, defaults[key]]));
    return Response.json({ tunable, defaults: pick, overrides, bounds: OWNER_BOUNDS }, { headers: { "Cache-Control": "private, no-store" } });
  });
}

/** Replaces the owner's thresholds for their shop. A value out of bounds, or a key that is not tunable, is refused (400), never rounded into range. */
export function PUT(req: Request) {
  return handle(async () => {
    const { session, shop } = await requireOwner(req);
    if (!(await appSettings().get("figures.ownerTunable"))) throw refuse(403, "FEATURE_OFF", "The thresholds are set by the administrator");
    const { overrides } = await readJson(req, body);
    const kept = parseOwnerOverrides(overrides);
    if (Object.keys(kept).length !== Object.keys(overrides).length) throw refuse(400, "BAD_REQUEST", "A threshold is out of bounds or cannot be changed");
    await saveShopFigureOverrides(db(), shop.id, kept);
    await audit({ action: "shop.figure_rules_changed", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: kept, headers: req.headers });
    return Response.json({ overrides: kept });
  });
}
