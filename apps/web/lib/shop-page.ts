import { slugSchema } from "@akinaza/core";
import { currentSlugOf, publicShop } from "@akinaza/db";
import { permanentRedirect } from "next/navigation";

import { db } from "@/lib/db";

/** A published shop by its address; null when the address is malformed or there is none (the page answers 404). */
export async function loadPublicShop(slug: string) {
  const parsed = slugSchema.safeParse(slug);
  return parsed.success ? publicShop(db(), parsed.data) : null;
}

/** The address a former slug now leads to, `/{locale}/s/{current}{rest}`, or null (#77: printed links never break). */
export async function movedShopPath(locale: string, slug: string, rest = ""): Promise<string | null> {
  const parsed = slugSchema.safeParse(slug);
  const current = parsed.success ? await currentSlugOf(db(), parsed.data) : null;
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
  const pairs = Object.entries(query).flatMap(([k, v]) => (v === undefined ? [] : Array.isArray(v) ? v : [v]).map((x) => [k, x] as [string, string]));
  return pairs.length ? `?${new URLSearchParams(pairs).toString()}` : "";
}
