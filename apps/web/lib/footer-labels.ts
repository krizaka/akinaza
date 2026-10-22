import { type FamilyLabels, familyLabels, type SiteLocale } from "@krizaka/ui/sites";

/**
 * What the product footer (a client component) is given: the link-back words only — « A Krizaka product », the place, the
 * version's name and the language. The family's one-liners, group titles and statuses are for the family footer and
 * never travel in this site's pages. (Until `labels` is optional in product mode in @krizaka/ui, the unused records are empty.)
 */
export function productFooterLabels(locale: SiteLocale): FamilyLabels {
  const all = familyLabels[locale];
  return {
    family: "",
    current: "",
    groups: {} as FamilyLabels["groups"],
    status: {} as FamilyLabels["status"],
    descriptions: {} as FamilyLabels["descriptions"],
    signature: { product: all.signature.product } as FamilyLabels["signature"],
    place: all.place,
    version: all.version,
    lang: all.lang ?? locale,
  };
}
