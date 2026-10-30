import { feedByTokenHash, feedEntriesAround, feedTitle } from "@akinaza/db";

import { db } from "@/lib/db";
import { sessionSecret } from "@/lib/env";
import { feedTokenHash, tokenOfSegment } from "@/lib/feed-token";
import { handle, refuse } from "@/lib/http";
import { buildFeedIcs } from "@/lib/ics";
import { limit } from "@/lib/rate-limit";
import { appSettings } from "@/lib/settings";
import { requestNow } from "@/app/request-now";

export const dynamic = "force-dynamic";

// @fixed: what a calendar app needs: the last fortnight for context, four months ahead for planning
const BEHIND_DAYS = 14;
const AHEAD_DAYS = 120;

const NOT_FOUND = () => refuse(404, "NOT_FOUND", "Not found");

/**
 * A private calendar feed (RFC 5545, ADR-004): the address is the secret, with the token in the path. An unknown, rotated or revoked token, and a feed
 * the administrator switched off, all answer the same 404. First names and the service only; never cached by a shared cache.
 */
export function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    limit("calendar-feed", req, null, [120, 900]);
    const token = tokenOfSegment((await ctx.params).token);
    if (!token || !(await appSettings().get("exports.icsFeed.enabled"))) throw NOT_FOUND();
    const feed = await feedByTokenHash(db(), feedTokenHash(token, sessionSecret()));
    if (!feed) throw NOT_FOUND();
    const now = requestNow();
    const entries = await feedEntriesAround(db(), feed, now, BEHIND_DAYS, AHEAD_DAYS);
    const body = buildFeedIcs({
      name: await feedTitle(db(), feed),
      entries: entries.map((e) => ({ appointmentId: e.appointmentId, start: e.startsAt, end: e.endsAt, service: e.service.fr, firstNames: e.firstNames })),
      now,
    });
    return new Response(body, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="agenda.ics"',
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
        "Referrer-Policy": "no-referrer",
      },
    });
  });
}
