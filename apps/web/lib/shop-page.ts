import { slugSchema } from "@akinaza/core";
import { currentSlugOf, publicShop } from "@akinaza/db";
import { permanentRedirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/lib/db";

/**
 * A published shop by its address; null when the address is malformed or there is none (the page answers 404). Read once per
 * request: the storefront's layout asks it to answer 404 before anything streams, the page and `generateMetadata` ask it again.
 */
export const loadPublicShop = cache(async (slug: string) => {
  const parsed = slugSchema.safeParse(slug);
  return parsed.success ? publicShop(db(), parsed.data) : null;
});

/** The current slug a former address leads to, or null; once per request like `loadPublicShop`. */
const currentSlugOfFormer = cache(async (slug: string) => {
  const parsed = slugSchema.safeParse(slug);
  return parsed.success ? currentSlugOf(db(), parsed.data) : null;
});

/** The address a former slug now leads to, `/{locale}/s/{current}{rest}`, or null (#77: printed links never break). */
export async function movedShopPath(locale: string, slug: string, rest = ""): Promise<string | null> {
  const current = await currentSlugOfFormer(slug);
  return current ? `/${locale}/s/${current}${rest}` : null;
}

/** A published shop by its address or, for a former address, a 308 to the current one; null when neither (404). */
export async function loadPublicShopOrMove(locale: string, slug: string, rest = "") {
  const page = await loadPublicShop(slug);
  if (page) return page;
  const moved = await movedShopPath(locale, slug, rest);
  if (moved) permanentRedirect(moved);
  return null;
}

/** `?staff=…&zone=…` from a page's search params (empty when there are none): a redirect keeps the choices made. */
export function queryString(query: Record<string, string | string[] | undefined>): string {
  const pairs = Object.entries(query).flatMap(([k, v]) => [v ?? []].flat().map((x) => [k, x] as [string, string]));
  return pairs.length ? `?${new URLSearchParams(pairs).toString()}` : "";
}
