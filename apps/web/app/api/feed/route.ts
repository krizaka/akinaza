import { feedFlyers } from "@akinaza/db";

import { db } from "@/lib/db";
import { buildFeed } from "@/lib/feed-view";
import { handle } from "@/lib/http";
import { asLocale } from "@/lib/i18n";
import { limit } from "@/lib/rate-limit";
import { shopSectionFeatures } from "@/lib/settings";

export const dynamic = "force-dynamic";

// @fixed: a neighbourhood is a name, never a paragraph
const MAX_QUARTIER = 80;

/**
 * The neighbourhood feed (public): the flyers the shops pinned on their own page, newest first, optionally those of one
 * neighbourhood (`?quartier=Saint-Henri`), in the asked language (`?locale=fr`). Nothing leaves the shop but its name,
 * its page and what the owner already published. Off with the bulletin board's switch.
 */
export function GET(req: Request) {
  return handle(async () => {
    limit("feed", req, null, [120, 60]);
    const url = new URL(req.url);
    const locale = asLocale(url.searchParams.get("locale") ?? "en");
    const quartier = (url.searchParams.get("quartier") ?? "").slice(0, MAX_QUARTIER);
    const on = (await shopSectionFeatures()).announcements;
    const view = buildFeed({ rows: on ? await feedFlyers(db()) : [], locale, quartier });
    return Response.json(view, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  });
}
