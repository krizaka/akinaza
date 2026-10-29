import type { ShopType } from "../shop-media";
import { TEMPLATES, TEMPLATES_V2 } from "./catalogue";
import type { Template } from "./schema";

/**
 * The template a shop renders with: the one it **applied** (`id@version`, kept even when the template has improved since), or `null` - **a shop with no template
 * stays on today's rendering, always**, whatever an administrator sets later (#261, ADR). An id the catalogue no longer knows is also `null`: the page never breaks.
 */
export function resolveTemplate(shop: { templateId?: string | null; templateVersion?: number | null }, catalogue: readonly Template[] = [...TEMPLATES, ...TEMPLATES_V2]): Template | null {
  if (!shop.templateId) return null;
  const sameId = catalogue.filter((t) => t.id === shop.templateId);
  return sameId.find((t) => t.version === shop.templateVersion) ?? null;
}

/** The latest version of a template (what « update available » compares against), or null. */
export function latestTemplate(id: string, catalogue: readonly Template[] = TEMPLATES): Template | null {
  return catalogue.filter((t) => t.id === id).sort((a, b) => b.version - a.version)[0] ?? null;
}

/** The templates the administrator offers for a trade (latest version of each), all of them when `offered` is not given. */
export function templatesFor(type: ShopType, offered?: readonly string[], catalogue: readonly Template[] = TEMPLATES): Template[] {
  const ids = [...new Set(catalogue.filter((t) => t.shopTypes.includes(type)).map((t) => t.id))];
  return ids.filter((id) => !offered || offered.includes(id)).map((id) => latestTemplate(id, catalogue)!);
}

/**
 * The template the picker preselects: the administrator's default for the trade when it is offered, else the first offered. It only **preselects**: nothing applies
 * until the owner chooses, and an existing shop with no template is never changed by it.
 */
export function preselectedTemplate(type: ShopType, adminDefault: string | null | undefined, offered?: readonly string[], catalogue: readonly Template[] = TEMPLATES): Template | null {
  const choices = templatesFor(type, offered, catalogue);
  return choices.find((t) => t.id === adminDefault) ?? choices[0] ?? null;
}
