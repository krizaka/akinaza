import { z } from "zod";

import { systemClock } from "@/app/system-clock";
import { oauthApps } from "@/app/calendar-edge";
import { agendaScope, requireShop } from "@/lib/access";
import { CALENDAR_CONSENT_VERSION, calendarOverview } from "@/lib/calendar/overview";
import { isOAuthKind, newPkce, pkceCookie, signState } from "@/lib/calendar/oauth-state";
import { connectable } from "@/lib/calendar/registry";
import { env, sessionSecret } from "@/lib/env";
import { handle, readJson, refuse } from "@/lib/http";
import { limit } from "@/lib/rate-limit";
import { appSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const body = z.object({ label: z.string().trim().min(1).max(80), staffId: z.string().uuid().nullable().default(null), locale: z.enum(["en", "fr"]), consent: z.literal(true) });

/**
 * Starts the owner's consent at the provider (OAuth authorization code with PKCE and a signed state). Answers the address to go to; the
 * PKCE verifier stays in an HttpOnly cookie of this browser, never in the address. Nothing is kept until the provider brings the owner back.
 */
export function POST(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  return handle(async () => {
    const kind = (await params).kind;
    if (!isOAuthKind(kind)) throw refuse(404, "NOT_FOUND", "Not found");
    const input = await readJson(req, body);
    limit("calendar-connect", req, null, [20, 3600]);
    const s = appSettings();
    if (!(await s.get("features.calendarSync")) || !(await s.get(`calendarSync.${kind}.enabled`))) throw refuse(403, "FEATURE_OFF", "This feature is switched off", { feature: "calendarSync" });
    const source = connectable(kind, oauthApps());
    if (!source) throw refuse(403, "FEATURE_OFF", "This feature is switched off", { feature: "calendarSync" });
    const { shop, role, session } = await requireShop(req, "agenda");
    const overview = await calendarOverview(shop.id, agendaScope(role, session.account.id));
    if (input.staffId === null ? !overview.wholeShop : !overview.people.some((p) => p.id === input.staffId)) throw refuse(404, "NOT_FOUND", "Not found");
    const { state, nonce } = signState({ kind, shopId: shop.id, staffId: input.staffId, accountId: session.account.id, label: input.label, locale: input.locale }, sessionSecret(), systemClock.now());
    const pkce = newPkce();
    const redirectUri = `${env().APP_PUBLIC_URL.replace(/\/$/, "")}/api/calendars/callback/${kind}`;
    const url = source.authorizeUrl({ state, redirectUri, codeChallenge: pkce.challenge, loginHint: session.account.email });
    return Response.json({ url, consent: CALENDAR_CONSENT_VERSION }, { headers: { "Cache-Control": "private, no-store", "Set-Cookie": pkceCookie(nonce, pkce.verifier, redirectUri.startsWith("https:")) } });
  });
}
