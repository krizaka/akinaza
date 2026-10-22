import { z } from "zod";

import { requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { handle, idParam, readJson } from "@/lib/http";
import { team, teamAct } from "@/lib/team";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ accountId: string }> };

/** Changes a member's role (within what the actor may hand out; the last owner stays). */
export const PATCH = (req: Request, { params }: Ctx) =>
  handle(async () => {
    const { session, shop } = await requireShop(req, "team");
    const target = idParam((await params).accountId);
    const { role } = await readJson(req, z.object({ role: z.string().max(20) }));
    await teamAct(() => team().setRole(shop.id, { id: session.account.id }, target, role));
    await audit({ action: "team.role_changed", actorId: session.account.id, actorLabel: session.account.email, targetId: target, detail: { shopId: shop.id, role }, headers: req.headers });
    return Response.json({ ok: true });
  });

/** Removes a member from the shop (the last owner stays). */
export const DELETE = (req: Request, { params }: Ctx) =>
  handle(async () => {
    const { session, shop } = await requireShop(req, "team");
    const target = idParam((await params).accountId);
    await teamAct(() => team().remove(shop.id, { id: session.account.id }, target));
    await audit({ action: "team.member_removed", actorId: session.account.id, actorLabel: session.account.email, targetId: target, detail: { shopId: shop.id }, headers: req.headers });
    return Response.json({ ok: true });
  });
