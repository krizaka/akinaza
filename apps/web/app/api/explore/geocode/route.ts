import { geocoder } from "@/app/geocoder-edge";
import { geocodeAnswer } from "@/lib/explore-geocode";
import { handle } from "@/lib/http";
import { asLocale } from "@/lib/i18n";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Explorer's address and postal-code search (public): `?q=H2X 1Y4&locale=fr` → `{ places, attribution }`. It goes through the geocoding
 * port (the vendor is the environment's), rate limited per address, its answers cached; the visitor's search is not stored.
 */
export function GET(req: Request) {
  return handle(async () => {
    limit("explore-geocode", req, null, [30, 60]);
    const url = new URL(req.url);
    const answer = await geocodeAnswer(geocoder(), url.searchParams.get("q") ?? "", asLocale(url.searchParams.get("locale") ?? "en"), req.signal);
    return Response.json(answer, { headers: { "Cache-Control": "private, no-store" } });
  });
}
