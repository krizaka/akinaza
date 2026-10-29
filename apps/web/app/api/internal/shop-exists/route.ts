import { slugSchema } from "@akinaza/core";
import { currentSlugOf, publicShop } from "@akinaza/db";

import { db } from "@/lib/db";
import { NOINDEX } from "@/lib/indexing";

export const dynamic = "force-dynamic";

/**
 * Whether an address is a shop (ADR-005 slice 4, akinaza#549): `{ slug }` for a published shop (a held or unpublished one is none), `{ moved }` for a former
 * address that leads to a current one, `{}` otherwise. The proxy asks it for a shop host before routing anything; it says nothing the public page does not.
 */
export async function GET(request: Request) {
  const parsed = slugSchema.safeParse(new URL(request.url).searchParams.get("slug") ?? "");
  const headers = { "cache-control": "no-store", "x-robots-tag": NOINDEX };
  if (!parsed.success) return Response.json({}, { headers });
  if (await publicShop(db(), parsed.data)) return Response.json({ slug: parsed.data }, { headers });
  const moved = await currentSlugOf(db(), parsed.data);
  return Response.json(moved ? { moved } : {}, { headers });
}
