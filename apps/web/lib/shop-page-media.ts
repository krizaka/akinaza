import type { ShopPage } from "@krizaka/ui/shop";

/**
 * Where each photo of a shop page goes (akinaza#401): the cover first (it is the LCP), then the sections in the page's order. A photo appears ONCE on a page -
 * a section receives only the photos no earlier section used (matched on the address, the cover's included), a disabled section takes none, and the gallery
 * keeps its bound. Pure; the page draws what this returns, `shop-page-media.test.ts` holds the rule.
 */
export interface PlacedPhoto {
  id: string;
  src: string;
  alt: string;
  caption?: string;
  video?: { webm?: string; mp4?: string };
}
export interface PhotoPool {
  cover: { src: string; alt: string; video?: { webm?: string; mp4?: string } } | null;
  /** The shop's gallery (its own, else the proposed ones), in order. */
  gallery: readonly PlacedPhoto[];
  /** The wall's polaroids. */
  wall: readonly PlacedPhoto[];
}
export interface PhotoPlan {
  cover: PhotoPool["cover"];
  /** The photos of each section, by its key (the gallery sections, and the closing call's single photo). */
  sections: Readonly<Record<string, readonly PlacedPhoto[]>>;
}

/** The most photos a gallery holds (ui `SHOP_LIMITS.photos`). @fixed: ADR-007 §3, a product limit of the document. */
const PHOTOS_PER_GALLERY = 12;

const identity = (src: string) => src.split("?")[0]!;

type Section = Pick<ShopPage, "sections">["sections"][number];

/** The photos a gallery section takes from the pool: the wall's polaroids for `wall`, the gallery otherwise, the picked ones for `pick`, bounded. */
function galleryPhotos(section: Extract<Section, { type: "gallery" }>, pool: PhotoPool, take: (src: string) => boolean): readonly PlacedPhoto[] {
  const source = section.variant === "wall" ? pool.wall : pool.gallery;
  const picked = new Set(section.settings.source === "pick" ? (section.blocks ?? []).flatMap((b) => (b.type === "photo" ? [b.settings.mediaId] : [])) : []);
  const wanted = section.settings.source === "pick" ? source.filter((p) => picked.has(p.id)) : source;
  const placed: PlacedPhoto[] = [];
  for (const p of wanted) {
    if (placed.length >= PHOTOS_PER_GALLERY) break;
    if (take(p.src)) placed.push(p);
  }
  return placed;
}

export function planPhotos(doc: Pick<ShopPage, "sections">, pool: PhotoPool): PhotoPlan {
  const used = new Set<string>();
  const take = (src: string) => {
    const id = identity(src);
    if (used.has(id)) return false;
    used.add(id);
    return true;
  };
  let cover: PhotoPool["cover"] = null;
  const sections: Record<string, readonly PlacedPhoto[]> = {};
  for (const section of doc.sections) {
    if (section.disabled) continue;
    if (section.type === "hero" && !cover && pool.cover && take(pool.cover.src)) cover = pool.cover;
    if (section.type === "gallery") sections[section.key] = galleryPhotos(section, pool, take);
    // The closing call's photo: the first one of the shop no earlier section drew (none: the shop's mark stands in).
    if (section.type === "booking" && section.variant === "closing") {
      const left = [...pool.gallery, ...pool.wall].find((p) => take(p.src));
      if (left) sections[section.key] = [left];
    }
  }
  return { cover, sections };
}

/** Every address a plan draws, the cover included: a page that lists one twice is wrong. */
export const placedAddresses = (plan: PhotoPlan): string[] => [...(plan.cover ? [identity(plan.cover.src)] : []), ...Object.values(plan.sections).flatMap((photos) => photos.map((p) => identity(p.src)))];

/** The rest of the page's pictures (a video's poster) claim their address after the plan: one already drawn is left out (the video shows its own frame), never repeated. */
export function photoLedger(plan: PhotoPlan): (src: string | null | undefined) => string | undefined {
  const used = new Set(placedAddresses(plan));
  return (src) => {
    if (!src) return undefined;
    const id = identity(src);
    if (used.has(id)) return undefined;
    used.add(id);
    return src;
  };
}
