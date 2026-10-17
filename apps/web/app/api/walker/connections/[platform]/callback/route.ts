import { connectPlatform, ShopError } from "@akinaza/db";

import { requireOwner } from "@/lib/access";
import { db } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { handle, refuse } from "@/lib/http";
import { verifyState } from "@/lib/oauth-state";

import { connectorOr404, stateKey, syncKey } from "../../shared";

export const dynamic = "force-dynamic";

/**
 * Where the platform sends the owner back: the signed state must be ours, for this shop and platform, then the code is
 * exchanged for the tokens (sealed at once). Always ends on the Connections screen, with the outcome in the address.
 */
export function GET(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  return handle(async () => {
    const { session, shop } = await requireOwner(req);
    const connector = connectorOr404((await params).platform);
    const url = new URL(req.url);
    const back = (query: string) => new Response(null, { status: 303, headers: { location: `${readEnv().APP_PUBLIC_URL}/${session.account.locale}/app/connections?${query}` } });
    if (!verifyState(url.searchParams.get("state"), { shopId: shop.id, platform: connector.platform, now: new Date() }, stateKey())) throw refuse(400, "BAD_REQUEST", "Invalid state");
    const code = url.searchParams.get("code");
    if (!code) return back(`connect_error=SYNC_INVALID&platform=${connector.platform}`);
    try {
      // @fixed: consent was given on the Connections screen before this round trip started (the state proves it).
      await connectPlatform(db(), syncKey(), connector, { shopId: shop.id, code, consent: true });
    } catch (error) {
      if (error instanceof ShopError) return back(`connect_error=${error.code.replace(/^AK_/, "")}&platform=${connector.platform}`);
      throw error;
    }
    return back(`connected=${connector.platform}`);
  });
}
