import { pullProposal } from "@akinaza/db";

import { requireOwner } from "@/lib/access";
import { db } from "@/lib/db";
import { handle } from "@/lib/http";

import { connectorOr404, syncKey } from "../../shared";

export const dynamic = "force-dynamic";

/** Reads the platform's profile and stores the differences as a proposal for the owner to decide. Changes nothing else. */
export function POST(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  return handle(async () => {
    const { shop } = await requireOwner(req);
    const connector = connectorOr404((await params).platform);
    return Response.json(await pullProposal(db(), syncKey(), connector, { shopId: shop.id, now: new Date() }));
  });
}
