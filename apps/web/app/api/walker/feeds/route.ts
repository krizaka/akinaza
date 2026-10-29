import { feedPeople, revokeFeedToken, rotateFeedToken } from "@akinaza/db";
import { z } from "zod";

import { agendaScope, requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { readEnv, sessionSecret } from "@/lib/env";
import { feedOverview } from "@/lib/feed-overview";
import { feedTokenHash, feedUrl, newFeedToken } from "@/lib/feed-token";
import { handle, readJson, refuse } from "@/lib/http";
import { appSettings } from "@/lib/settings";
import { requestNow } from "@/app/request-now";

export const dynamic = "force-dynamic";

const body = z.object({ staffId: z.string().uuid().nullable().default(null) });

/**
 * Who may open which feed: the shop's own, and any staff member's, for who runs the bookings (owner, manager); a staff member opens only their own.
 * Another shop's staff id is the 404 of an id that exists nowhere.
 */
async function allowed(req: Request) {
  // The feature, the session and the shop come first: a caller with no right here learns nothing of what the body should say.
  if (!(await appSettings().get("exports.icsFeed.enabled"))) throw refuse(403, "FEATURE_OFF", "This feature is switched off", { feature: "exports.icsFeed" });
  const { shop, role, session } = await requireShop(req, "agenda");
  const scope = agendaScope(role, session.account.id);
  const people = await feedPeople(db(), shop.id, scope);
  const { staffId } = await readJson(req, body);
  if (staffId === null ? scope.staffAccountId !== undefined : !people.some((p) => p.id === staffId)) throw refuse(404, "NOT_FOUND", "Not found");
  return { shop, session, staffId };
}

/** The feeds the member may manage and whether each is live: never an address (only its hash is kept, so it cannot be shown again). */
export function GET(req: Request) {
  return handle(async () => {
    const { shop, role, session } = await requireShop(req, "agenda");
    return Response.json(await feedOverview(shop.id, agendaScope(role, session.account.id)), { headers: { "Cache-Control": "private, no-store" } });
  });
}

/** Makes the feed's first address, or rotates it (the old one is dead at once). The address is in this answer only, once. */
export function POST(req: Request) {
  return handle(async () => {
    const { shop, session, staffId } = await allowed(req);
    const token = newFeedToken();
    const feed = await rotateFeedToken(db(), { shopId: shop.id, staffId }, feedTokenHash(token, sessionSecret()), requestNow());
    if (!feed) throw refuse(404, "NOT_FOUND", "Not found");
    await audit({ action: feed.rotatedAt ? "shop.feed_rotated" : "shop.feed_created", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: { staffId }, headers: req.headers });
    return Response.json({ url: feedUrl(readEnv().APP_PUBLIC_URL, token), createdAt: feed.createdAt, rotatedAt: feed.rotatedAt }, { headers: { "Cache-Control": "private, no-store" } });
  });
}

/** Switches the feed off: its address answers 404 from now on. */
export function DELETE(req: Request) {
  return handle(async () => {
    const { shop, session, staffId } = await allowed(req);
    const revoked = await revokeFeedToken(db(), { shopId: shop.id, staffId }, requestNow());
    if (revoked) await audit({ action: "shop.feed_revoked", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: { staffId }, headers: req.headers });
    return Response.json({ revoked });
  });
}
