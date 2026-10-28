import { defaultFor, defaultUrl, listDefaults, type OrgDefaultKind } from "@krizaka/org";

/**
 * The default pictures of Akinaza come from the Krizaka org JSON (`@krizaka/org`, ADR-011, akinaza#411), never from a URL written here:
 * a shop gets a `shop` picture, a banner a `banner`, a person a `person` one. The set is versioned on Bunny and may drop an item, so
 * the answer is null (the caller draws nothing, or its own mark) when the kind has no picture left.
 */
export type DefaultPicture = { src: string; alt: { en: string; fr: string } };

export function defaultPicture(kind: OrgDefaultKind, seed: string, size = 512): DefaultPicture | null {
  const item = defaultFor(kind, seed);
  if (!item) return null;
  return { src: defaultUrl(item, size), alt: item.alt };
}

/** The kinds a picker of this subject may offer: a shop or a folder is never given a person (the Yomizaka binder bug). */
export const PICKER_KINDS = { person: ["person"], shop: ["shop"], banner: ["banner"] } as const satisfies Record<string, readonly OrgDefaultKind[]>;

export function pickerChoices(subject: keyof typeof PICKER_KINDS): { id: string; kind: OrgDefaultKind }[] {
  return PICKER_KINDS[subject].flatMap((kind) => listDefaults(kind).map((item) => ({ id: item.id, kind })));
}

/** The default banner of a shop or a profile without one, as the hero's cover (960 and 1920 px renditions): the same banner for the same seed. */
export function defaultBanner(seed: string): { src: string; srcSet: string } | null {
  const item = defaultFor("banner", seed);
  if (!item) return null;
  const [small, large] = [960, 1920].map((w) => defaultUrl(item, w));
  return { src: large!, srcSet: `${small} 960w, ${large} 1920w` };
}
