/**
 * The default images and videos a storefront offers so that no section is ever empty (#267). Data only: which shop types and media slots exist, and the
 * files each type has for each slot. The files themselves live on the media CDN (never in the repository); the manifest says which version of each.
 * Shop types and slot ids are shared with the storefront templates (#261).
 */

/** The trades Akinaza serves. Never restaurants, cafés or bars (AGENTS section 2). */
export const SHOP_TYPES = ["salon", "coaching", "workshop", "cleaning", "pets", "consulting"] as const;
export type ShopType = (typeof SHOP_TYPES)[number];

/** The shop type of a shop that has not chosen one: from its business type. */
export function shopTypeOf(businessType: "professional" | "pets", chosen?: string | null): ShopType {
  if (chosen && (SHOP_TYPES as readonly string[]).includes(chosen)) return chosen as ShopType;
  return businessType === "pets" ? "pets" : "consulting";
}

/**
 * The slots that take a media (their formats and ratios are in docs/design and issue #267). Only these have defaults in this first slice; `logo`, `about` and `team`
 * need none (a missing logo is fine, the avatars have their own defaults), the others come with their features.
 */
export const DEFAULT_SLOTS = {
  /** The hero: an image and its silent loop. 16:9. */
  cover: { count: 1, ratio: "16:9", widths: [640, 1280], video: true },
  /** The photos section. 4:3. */
  gallery: { count: 4, ratio: "4:3", widths: [480, 960], video: false },
  /** The image of a service card: crops of the gallery set. 3:2. */
  service: { count: 3, ratio: "3:2", widths: [480, 960], video: false },
} as const;
export type DefaultSlot = keyof typeof DEFAULT_SLOTS;
export const DEFAULT_SLOT_IDS = Object.keys(DEFAULT_SLOTS) as DefaultSlot[];

export const RENDITION_FORMATS = ["avif", "webp"] as const;

/** Where the defaults live, as logical paths under the media zone's `site/` root. */
export const DEFAULTS_ROOT = "products/akinaza/defaults";

export interface DefaultMedia {
  /** `salon-cover-1`: unique, stable (a stored choice names it). */
  id: string;
  type: ShopType;
  slot: DefaultSlot;
  /** 1-based position within the slot. */
  n: number;
  /** The message of its description: `console.defaultMedia.<type>.<slot>.<n>` (FR and EN). */
  altKey: string;
  /** Every file of it, as logical paths. */
  files: { images: { width: number; format: (typeof RENDITION_FORMATS)[number]; path: string }[]; video?: { webm: string; mp4: string; poster: string } };
}

function build(type: ShopType, slot: DefaultSlot, n: number): DefaultMedia {
  const spec = DEFAULT_SLOTS[slot];
  const dir = `${DEFAULTS_ROOT}/${type}/${slot}`;
  const name = `${type}-${slot}-${n}`;
  return {
    id: name,
    type,
    slot,
    n,
    altKey: `defaultMedia.${type}.${slot}.${n}`,
    files: {
      images: spec.widths.flatMap((width) => RENDITION_FORMATS.map((format) => ({ width, format, path: `${dir}/${name}-${width}.${format}` }))),
      ...(spec.video ? { video: { webm: `${dir}/${name}-loop.webm`, mp4: `${dir}/${name}-loop.mp4`, poster: `${dir}/${name}-poster.webp` } } : {}),
    },
  };
}

/** Every default, by type and slot. */
export const DEFAULT_MEDIA: readonly DefaultMedia[] = SHOP_TYPES.flatMap((type) => DEFAULT_SLOT_IDS.flatMap((slot) => Array.from({ length: DEFAULT_SLOTS[slot].count }, (_, i) => build(type, slot, i + 1))));

export const defaultsFor = (type: ShopType, slot: DefaultSlot): DefaultMedia[] => DEFAULT_MEDIA.filter((m) => m.type === type && m.slot === slot);

/** Every logical path the defaults use: what the CDN manifest must name. */
export const defaultMediaPaths = (): string[] => DEFAULT_MEDIA.flatMap((m) => [...m.files.images.map((f) => f.path), ...(m.files.video ? Object.values(m.files.video) : [])]);
