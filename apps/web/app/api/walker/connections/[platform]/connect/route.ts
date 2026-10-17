import { z } from "zod";

import { requireOwner } from "@/lib/access";
import { handle, readJson, refuse } from "@/lib/http";
import { signState } from "@/lib/oauth-state";

import { connectorOr404, redirectUri, stateKey } from "../../shared";

export const dynamic = "force-dynamic";

/** Starts the connection: the owner's explicit consent, then the address of the platform's consent screen (signed state). */
export function POST(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  return handle(async () => {
    const { shop } = await requireOwner(req);
    const connector = connectorOr404((await params).platform);
    const { consent } = await readJson(req, z.object({ consent: z.boolean() }));
    if (!consent) throw refuse(400, "SYNC_NO_CONSENT", "The owner must agree first");
    const state = signState({ shopId: shop.id, platform: connector.platform, now: new Date() }, stateKey());
    return Response.json({ authorizeUrl: connector.authorizeUrl({ state, redirectUri: redirectUri(connector.platform) }) });
  });
}
