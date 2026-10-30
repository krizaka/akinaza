import { parseExploreParams } from "@akinaza/core";
import { exploreSearch } from "@akinaza/db";

import { systemClock } from "@/app/system-clock";
import { db } from "@/lib/db";
import { handle } from "@/lib/http";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Explorer's shops (public, ADR-006): the published shops that pass the combined filters of the query string (`q`, `kind`, `open`,
 * `near`, `within`, `bbox`, `limit`, `offset`; an unknown or malformed one answers 400), with the facts of their public page, open now
 * and a free time today read at the request's moment. No parameter = every shop by name, as before. A request with `near` is the
 * visitor's own position: it is never shared by a cache.
 */
export function GET(req: Request) {
  return handle(async () => {
    limit("explore-shops", req, null, [60, 60]);
    const query = parseExploreParams(new URL(req.url).searchParams);
    const page = await exploreSearch(db(), query, systemClock.now());
    const cache = query.near ? "private, max-age=30" : "public, s-maxage=30, stale-while-revalidate=120";
    return Response.json(page, { headers: { "Cache-Control": cache } });
  });
}
