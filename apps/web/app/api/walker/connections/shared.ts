import type { Platform, SocialConnector } from "@akinaza/core";
import type { pullProposal } from "@akinaza/db";

import { requireOwner } from "@/lib/access";
import { db } from "@/lib/db";

import { connectorFor } from "@/lib/connectors";
import { dataKey, readEnv, sessionSecret } from "@/lib/env";
import { handle, refuse } from "@/lib/http";

/** What the connection routes share: the connector of a platform named in a path (404 when unknown or when connections are off), the keys, the return address. */
export function connectorOr404(platform: string): SocialConnector {
  const connector = connectorFor(platform, readEnv().APP_SOCIAL_SYNC);
  if (!connector) throw refuse(404, "NOT_FOUND", "No such connection");
  return connector;
}

export const redirectUri = (platform: Platform) => `${readEnv().APP_PUBLIC_URL}/api/walker/connections/${platform}/callback`;
export const syncKey = () => dataKey();
export const stateKey = () => sessionSecret();

/** `pull` and `push` are the same POST - owner, connector of the path, one sync call - and differ by the call they make. */
type SyncCall = (database: ReturnType<typeof db>, key: ReturnType<typeof syncKey>, connector: SocialConnector, context: Parameters<typeof pullProposal>[3]) => Promise<unknown>;

export function syncRoute(sync: SyncCall) {
  return (req: Request, { params }: { params: Promise<{ platform: string }> }) =>
    handle(async () => {
      const { shop } = await requireOwner(req);
      const connector = connectorOr404((await params).platform);
      return Response.json(await sync(db(), syncKey(), connector, { shopId: shop.id, now: new Date() }));
    });
}
