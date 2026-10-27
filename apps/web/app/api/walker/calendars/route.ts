import { type CalendarKind, CalendarSourceError } from "@akinaza/core";
import { addConnection, connectionSecret, openField, recordSyncOk, removeConnection, sealField } from "@akinaza/db";
import { z } from "zod";

import { configuredKinds, oauthApps } from "@/app/calendar-edge";
import { systemClock } from "@/app/system-clock";
import { agendaScope, requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { isOAuthKind } from "@/lib/calendar/oauth-state";
import { CALENDAR_CONSENT_VERSION, calendarOverview } from "@/lib/calendar/overview";
import { parseCalendarUrl } from "@/lib/calendar/public-url";
import { connectable, sealedCaldav, sourceFactory } from "@/lib/calendar/registry";
import { syncSettings, windowOf } from "@/lib/calendar/sync";
import { db } from "@/lib/db";
import { dataKey } from "@/lib/env";
import { handle, readJson, refuse } from "@/lib/http";
import { limit } from "@/lib/rate-limit";
import { appSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };
const common = { label: z.string().trim().min(1).max(80), staffId: z.string().uuid().nullable().default(null), consent: z.literal(true) };
const add = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ics"), url: z.string().trim().min(8).max(2000), ...common }),
  z.object({ kind: z.literal("caldav"), url: z.string().trim().min(8).max(2000), username: z.string().trim().min(1).max(200), password: z.string().min(1).max(500), ...common }),
]);
const remove = z.object({ id: z.string().uuid() });

/** The calendars the member may manage and whether each is read well: never an address (it is sealed, and shown to nobody again). */
export function GET(req: Request) {
  return handle(async () => {
    const { shop, role, session } = await requireShop(req, "agenda");
    return Response.json(await calendarOverview(shop.id, agendaScope(role, session.account.id), configuredKinds()), { headers: NO_STORE });
  });
}

/**
 * Connects an ICS address, read-only. The address is read once first, so a wrong one is refused in words before anything is kept; the owner's
 * consent (what is read and why) is recorded with the connection. Whose agenda it blocks follows the same rule as the private links.
 */
export function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req, add);
    limit("calendar-connect", req, null, [20, 3600]);
    const s = appSettings();
    if (!(await s.get("features.calendarSync")) || !(await s.get(`calendarSync.${body.kind}.enabled`))) throw refuse(403, "FEATURE_OFF", "This feature is switched off", { feature: "calendarSync" });
    const { shop, role, session } = await requireShop(req, "agenda");
    const overview = await calendarOverview(shop.id, agendaScope(role, session.account.id));
    if (body.staffId === null ? !overview.wholeShop : !overview.people.some((p) => p.id === body.staffId)) throw refuse(404, "NOT_FOUND", "Not found");
    const now = systemClock.now();
    const settings = await syncSettings();
    const sealed = body.kind === "caldav" ? sealedCaldav({ url: body.url, username: body.username, password: body.password }) : body.url.trim();
    let read;
    try {
      parseCalendarUrl(body.url);
      const source = sourceFactory({}, { caldav: true })(body.kind as CalendarKind, sealed, shop.timezone);
      read = await source!.busy(windowOf(now, settings.windowDays, shop.timezone), { etag: null, lastModified: null });
    } catch (error) {
      if (error instanceof CalendarSourceError) throw refuse(error.code === "AK_CAL_INVALID" || error.code === "AK_CAL_TOO_LARGE" ? 400 : 422, error.code.replace(/^AK_/, ""), error.code);
      throw error;
    }
    const id = crypto.randomUUID();
    const connection = await addConnection(db(), { id, shopId: shop.id, staffId: body.staffId, kind: body.kind, label: body.label, secretEnc: sealField(sealed, dataKey(), id), consentTextVersion: CALENDAR_CONSENT_VERSION, now, max: await s.get("calendarSync.maxCalendarsPerShop") });
    if (read?.changed) await recordSyncOk(db(), { id, shopId: shop.id, staffId: body.staffId }, { busy: read.busy, validators: read.validators }, now, settings.intervalMinutes);
    await audit({ action: "shop.calendar_connected", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: { connectionId: id, kind: body.kind, staffId: body.staffId, consent: CALENDAR_CONSENT_VERSION }, headers: req.headers });
    return Response.json({ id: connection.id }, { status: 201, headers: NO_STORE });
  });
}

/** Disconnects: the connection and the busy times it gave are deleted together; the slots it blocked are free again at once. */
export function DELETE(req: Request) {
  return handle(async () => {
    const { id } = await readJson(req, remove);
    const { shop, role, session } = await requireShop(req, "agenda");
    const overview = await calendarOverview(shop.id, agendaScope(role, session.account.id));
    if (!overview.connections.some((c) => c.id === id)) throw refuse(404, "NOT_FOUND", "Not found");
    // The provider is told to forget the grant first (best effort: the owner's choice to leave is never held back by the provider being down).
    const kept = await connectionSecret(db(), shop.id, id);
    if (kept && isOAuthKind(kept.kind)) await connectable(kept.kind, oauthApps(), openField(kept.secretEnc, dataKey(), id))?.revoke().catch(() => undefined);
    const removed = await removeConnection(db(), shop.id, id);
    if (removed) await audit({ action: "shop.calendar_removed", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: { connectionId: id }, headers: req.headers });
    return Response.json({ removed });
  });
}
