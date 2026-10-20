import type { Platform, SocialConnector } from "@akinaza/core";

import { connectorFor } from "@/lib/connectors";
import { dataKey, readEnv, sessionSecret } from "@/lib/env";
import { refuse } from "@/lib/http";

/** What the connection routes share: the connector of a platform named in a path (404 when unknown or when connections are off), the keys, the return address. */
export function connectorOr404(platform: string): SocialConnector {
  const connector = connectorFor(platform, readEnv().APP_SOCIAL_SYNC);
  if (!connector) throw refuse(404, "NOT_FOUND", "No such connection");
  return connector;
}

export const redirectUri = (platform: Platform) => `${readEnv().APP_PUBLIC_URL}/api/walker/connections/${platform}/callback`;
export const syncKey = () => dataKey();
export const stateKey = () => sessionSecret();
