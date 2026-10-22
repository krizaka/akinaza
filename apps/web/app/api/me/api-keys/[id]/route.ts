import { systemClock } from "@/app/system-clock";
import { requireOwner } from "@/lib/access";
import { apiKeys, keyAct } from "@/lib/api-access";
import { audit } from "@/lib/audit";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Revokes a key: it stops working at once. Revoking twice is fine. */
export const DELETE = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  handle(async () => {
    const { session } = await requireOwner(req);
    const { id } = await params;
    await keyAct(() => apiKeys(systemClock).revoke(session.account.id, id));
    await audit({ action: "apikey.revoked", actorId: session.account.id, actorLabel: session.account.email, targetId: id, headers: req.headers });
    return Response.json({ ok: true });
  });
