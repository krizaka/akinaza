import { ASSOCIATION_KINDS, associationProofOf, submitAssociationProof } from "@akinaza/db";
import { z } from "zod";

import { requireSession } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle, readJson } from "@/lib/http";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const proofSchema = z.object({ kind: z.enum(ASSOCIATION_KINDS), reference: z.string().min(1).max(80), note: z.string().max(500).optional() });

/** The state of the signed-in account's association proof (the latest): what the subscription page shows. */
export const GET = (req: Request) =>
  handle(async () => {
    const { account } = await requireSession(req);
    return Response.json({ proof: await associationProofOf(db(), account.id) }, { headers: { "Cache-Control": "private, no-store" } });
  });

/** The shop submits its proof (NEQ, registered charity number or incorporation reference) for an administrator to check; until approved it is on Starter. */
export const POST = (req: Request) =>
  handle(async () => {
    const { account } = await requireSession(req);
    limit("association", req, account.id, [5, 3600]);
    const body = await readJson(req, proofSchema);
    const id = await submitAssociationProof(db(), account.id, body);
    await audit({ action: "billing.association_submitted", actorId: account.id, actorLabel: account.email, targetId: id, detail: { kind: body.kind }, headers: req.headers });
    return Response.json({ id, status: "pending" }, { status: 201 });
  });
