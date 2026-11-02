import { brandOf, displayName } from "@krizaka/org";

/**
 * The commercial name (krizaka-internal#2039, #2103): the code name stays in the repository, the packages and the addresses;
 * every word a person reads is « Folioviv by Krizaka », read from `@krizaka/org` and never typed here. Surfaces drawn at build
 * (the static pages, the manifest, the social card) use this default; a surface drawn per request reads the administrator's
 * `brand.displayName` through `productName()` (lib/brand-name.ts).
 */
export const CODE_NAME = "akinaza";

/** The name shown when the administrator has set none. */
export const PRODUCT_NAME = displayName(CODE_NAME);

/** A message tree with `{product}` filled in. Pure: the catalogues keep the placeholder, the bound copy is what a page reads. */
export function bindProduct<T>(tree: T, name: string = PRODUCT_NAME): T {
  if (typeof tree === "string") {
    return tree.replaceAll("{product}", name) as T;
  }
  if (Array.isArray(tree)) {
    return tree.map((item) => bindProduct(item, name)) as T;
  }
  if (tree && typeof tree === "object") {
    return Object.fromEntries(Object.entries(tree).map(([key, value]) => [key, bindProduct(value, name)])) as T;
  }
  return tree;
}

/** « by Krizaka » / « par Krizaka »: the endorsement under the name, for `ProductLockup`. */
export const endorsementIn = (locale: "en" | "fr"): string => brandOf(CODE_NAME).endorsement[locale];
