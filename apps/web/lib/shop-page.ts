import { slugSchema } from "@akinaza/core";
import { publicShop } from "@akinaza/db";

import { db } from "@/lib/db";

/** A published shop by its address; null when the address is malformed or there is none (the page answers 404). */
export async function loadPublicShop(slug: string) {
  const parsed = slugSchema.safeParse(slug);
  return parsed.success ? publicShop(db(), parsed.data) : null;
}
