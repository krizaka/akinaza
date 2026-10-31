import { decideAssociation } from "@akinaza/db";
import { z } from "zod";

import { systemClock } from "@/app/system-clock";
import { requireAdmin } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle, idParam, readJson, refuse } from "@/lib/http";

export const dynamic = "force-dynamic";

const decisionSchema = z.object({ decision: z.enum(["approved", "rejected"]), note: z.string().max(500).optional() });

/** Approves or refuses a pending proof, once. 404 when it is unknown or already decided. Audited with the decision. */
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin(req);
    const id = idParam((await params).id);
    const { decision, note } = await readJson(req, decisionSchema);
    if (!(await decideAssociation(db(), id, admin.account.id, decision, systemClock.now(), note))) {throw refuse(404, "NOT_FOUND", "This proof is not waiting for a decision");}
    await audit({ action: `billing.association_${decision}`, actorId: admin.account.id, actorLabel: admin.account.email, targetId: id, detail: note ? { note } : {}, headers: req.headers });
    return Response.json({ ok: true });
  });
}
