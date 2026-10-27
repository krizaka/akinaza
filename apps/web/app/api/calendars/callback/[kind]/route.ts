import { CalendarSourceError } from "@akinaza/core";
import { addConnection, recordSyncOk, sealField } from "@akinaza/db";

import { oauthApps } from "@/app/calendar-edge";
import { systemClock } from "@/app/system-clock";
import { agendaScope, requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { clearPkceCookie, isOAuthKind, verifierFor, verifyState } from "@/lib/calendar/oauth-state";
import { CALENDAR_CONSENT_VERSION, calendarOverview } from "@/lib/calendar/overview";
import { connectable } from "@/lib/calendar/registry";
import { syncSettings, windowOf } from "@/lib/calendar/sync";
import { db } from "@/lib/db";
import { dataKey, env, sessionSecret } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { appSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

type Outcome = "connected" | "denied" | "error";

/** Back to Boutique > Agenda with the outcome in the address (a word, never a code or a token), the PKCE cookie spent whatever happened. */
function back(path: string, outcome: Outcome, secure: boolean): Response {
  return new Response(null, { status: 303, headers: { Location: `${path}?calendar=${outcome}`, "Cache-Control": "private, no-store", "Set-Cookie": clearPkceCookie(secure) } });
}

/**
 * The provider brings the owner back with a code. The signed state, the browser's PKCE cookie and the signed-in account must all agree
 * before the code is exchanged; the grant (a refresh token) is sealed at once and never leaves the server again.
 */
export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const kind = (await params).kind;
  const secure = env().APP_PUBLIC_URL.startsWith("https:");
  const url = new URL(req.url);
  const now = systemClock.now();
  const state = verifyState(url.searchParams.get("state") ?? "", sessionSecret(), now);
  if (!isOAuthKind(kind) || !state || state.kind !== kind) return new Response("Not found", { status: 404, headers: { "Set-Cookie": clearPkceCookie(secure) } });
  const agenda = `/${state.locale}/app/${state.shopId}/boutique/agenda`;
  try {
    const verifier = verifierFor(req.headers.get("cookie"), state.nonce);
    const { shop, role, session } = await requireShop(new Request(new URL(`/?shopId=${state.shopId}`, req.url), { headers: req.headers }), "agenda");
    if (session.account.id !== state.accountId || !verifier) return back(agenda, "error", secure);
    if (url.searchParams.get("error")) return back(agenda, url.searchParams.get("error") === "access_denied" ? "denied" : "error", secure);
    const code = url.searchParams.get("code");
    const s = appSettings();
    const source = connectable(kind, oauthApps());
    if (!code || !source || !(await s.get("features.calendarSync")) || !(await s.get(`calendarSync.${kind}.enabled`))) return back(agenda, "error", secure);
    const overview = await calendarOverview(shop.id, agendaScope(role, session.account.id));
    if (state.staffId === null ? !overview.wholeShop : !overview.people.some((p) => p.id === state.staffId)) return back(agenda, "error", secure);
    const grant = await source.exchange({ code, redirectUri: `${env().APP_PUBLIC_URL.replace(/\/$/, "")}/api/calendars/callback/${kind}`, codeVerifier: verifier });
    const id = crypto.randomUUID();
    await addConnection(db(), { id, shopId: shop.id, staffId: state.staffId, kind, label: state.label, secretEnc: sealField(grant.secret, dataKey(), id), consentTextVersion: CALENDAR_CONSENT_VERSION, now, max: await s.get("calendarSync.maxCalendarsPerShop") });
    await audit({ action: "shop.calendar_connected", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: { connectionId: id, kind, staffId: state.staffId, consent: CALENDAR_CONSENT_VERSION }, headers: req.headers });
    // A first read right away, so the slots are blocked at once; if it fails the tick tries again with its backoff.
    const settings = await syncSettings();
    const read = await connectable(kind, oauthApps(), grant.secret)!
      .busy(windowOf(now, settings.windowDays, shop.timezone), { etag: null, lastModified: null })
      .catch((error: unknown) => (error instanceof CalendarSourceError ? null : Promise.reject(error)));
    if (read?.changed) await recordSyncOk(db(), { id, shopId: shop.id, staffId: state.staffId }, { busy: read.busy, validators: read.validators }, now, settings.intervalMinutes);
    return back(agenda, "connected", secure);
  } catch (error) {
    if (!(error instanceof HttpError) && !(error instanceof CalendarSourceError)) console.error("[akinaza] calendar callback failed", error instanceof Error ? error.message : "unknown");
    return back(agenda, "error", secure);
  }
}
