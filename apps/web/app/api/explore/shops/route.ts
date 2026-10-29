import { exploreShops } from "@akinaza/db";

import { systemClock } from "@/app/system-clock";
import { db } from "@/lib/db";
import { handle } from "@/lib/http";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Explorer's shops (public): the published shops with the facts of their public page, open now and a free time today read at the request's moment. Filters and ranking run in the browser, on this list. */
export function GET(req: Request) {
  return handle(async () => {
    limit("explore-shops", req, null, [60, 60]);
    const shops = await exploreShops(db(), systemClock.now());
    return Response.json({ shops }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } });
  });
}
