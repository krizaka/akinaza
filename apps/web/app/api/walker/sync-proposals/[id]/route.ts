import { decideProposal, decisionInputSchema } from "@akinaza/db";
import { z } from "zod";

import { requireOwner } from "@/lib/access";
import { db } from "@/lib/db";
import { handle, idParam, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The owner's choices on a proposal, field by field: `accept` takes the platform's value, `keep` keeps Akinaza's. */
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { shop } = await requireOwner(req);
    const { decisions } = await readJson(req, z.object({ decisions: z.array(decisionInputSchema).min(1).max(10) }));
    await decideProposal(db(), { shopId: shop.id, proposalId: idParam((await params).id), decisions });
    return Response.json({ ok: true });
  });
}
