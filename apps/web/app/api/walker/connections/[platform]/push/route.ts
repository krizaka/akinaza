import { pushChanges } from "@akinaza/db";

import { requireOwner } from "@/lib/access";
import { db } from "@/lib/db";
import { handle } from "@/lib/http";

import { connectorOr404, syncKey } from "../../shared";

export const dynamic = "force-dynamic";

/** Publishes Akinaza's values to the platform. A difference nobody decided yet is left alone and reported. */
export function POST(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  return handle(async () => {
    const { shop } = await requireOwner(req);
    const connector = connectorOr404((await params).platform);
    return Response.json(await pushChanges(db(), syncKey(), connector, { shopId: shop.id, now: new Date() }));
  });
}
