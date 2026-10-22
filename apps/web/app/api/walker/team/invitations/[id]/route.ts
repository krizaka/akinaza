import { systemClock } from "@/app/system-clock";
import { requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { handle, idParam } from "@/lib/http";
import { team, teamAct } from "@/lib/team";

export const dynamic = "force-dynamic";

/** Withdraws a pending invitation (one for a role the actor may hand out). */
export const DELETE = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  handle(async () => {
    const { session, shop } = await requireShop(req, "team");
    const id = idParam((await params).id);
    await teamAct(() => team().revokeInvitation(shop.id, { id: session.account.id }, id, systemClock.now()));
    await audit({ action: "team.invitation_revoked", actorId: session.account.id, actorLabel: session.account.email, targetId: id, headers: req.headers });
    return Response.json({ ok: true });
  });
