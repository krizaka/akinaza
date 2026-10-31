import { slugSchema } from "@akinaza/core";
import { activeDomainOfSlug, currentSlugOf, publicShop, shopOfCustomHost } from "@akinaza/db";

import { db } from "@/lib/db";
import { NOINDEX } from "@/lib/indexing";

export const dynamic = "force-dynamic";

/**
 * Whether an address is a shop (ADR-005 slice 4, akinaza#549): `{ slug }` for a published shop (a held or unpublished one is none), `{ moved }` for a former
 * address that leads to a current one, `{}` otherwise. The proxy asks it for a shop host before routing anything; it says nothing the public page does not.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const headers = { "cache-control": "no-store", "x-robots-tag": NOINDEX };
  // `?host=`: the shop an active custom domain serves (ADR-005 §3, #539); nothing for any other name.
  const host = params.get("host");
  if (host !== null) {return Response.json((await shopOfCustomHost(db(), host)) ?? {}, { headers });}
  const parsed = slugSchema.safeParse(params.get("slug") ?? "");
  if (!parsed.success) {return Response.json({}, { headers });}
  const shop = await publicShop(db(), parsed.data);
  if (shop) {return Response.json({ slug: parsed.data, domain: await activeDomainOfSlug(db(), parsed.data) }, { headers });}
  const moved = await currentSlugOf(db(), parsed.data);
  return Response.json(moved ? { moved } : {}, { headers });
}
