import { shopOfOwner } from "@akinaza/db";

import { systemClock } from "@/app/system-clock";

import { requireApiKey } from "./api-access";
import { db } from "./db";
import { handle, idParam, refuse } from "./http";

/**
 * A read of the public API: the key's scope, the owner's shop (the default one, or `?shopId=` — another of theirs), the answer as
 * JSON. Everything the owner's own screens read, nothing more: no access notes, no secret, no other shop's data.
 */
export const v1 = (req: Request, scope: string, read: (shop: { id: string; timezone: string }, url: URL) => Promise<unknown>) =>
  handle(async () => {
    const { ownerId } = await requireApiKey(req, scope, systemClock);
    const url = new URL(req.url);
    const asked = url.searchParams.get("shopId");
    const shop = await shopOfOwner(db(), ownerId, asked ? idParam(asked) : undefined);
    if (!shop) throw refuse(404, "NO_SHOP", "No such shop");
    return new Response(JSON.stringify(await read(shop, url)), { headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
  });
