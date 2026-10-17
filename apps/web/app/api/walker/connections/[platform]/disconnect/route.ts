import { disconnectPlatform } from "@akinaza/db";

import { requireOwner } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle } from "@/lib/http";

import { connectorOr404, syncKey } from "../../shared";

export const dynamic = "force-dynamic";

/** Revokes the access at the platform, erases the stored token, forgets the account. */
export function POST(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  return handle(async () => {
    const { session, shop } = await requireOwner(req);
    const connector = connectorOr404((await params).platform);
    await disconnectPlatform(db(), syncKey(), connector, { shopId: shop.id });
    await audit({ action: "social.disconnect", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: { platform: connector.platform }, headers: req.headers });
    return Response.json({ ok: true });
  });
}
