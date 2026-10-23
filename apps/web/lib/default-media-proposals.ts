import { defaultsFor, SHOP_TYPES, type ShopType } from "@akinaza/core";

import { defaultImage, defaultVideo } from "@/lib/default-media";
import { getDictionary } from "@/lib/i18n";

/** What the owner's picker shows for a trade: the cover (with its loop) and the photos, each described in French and in English (it is saved as the shop's own alt text). */
export interface Proposal {
  id: string;
  /** The picture to show (WebP) and, for a cover, its loop. */
  src: string;
  webm?: string;
  mp4?: string;
  altFr: string;
  altEn: string;
}
export interface Proposals {
  cover: Proposal | null;
  gallery: Proposal[];
}

const alt = (locale: "fr" | "en", altKey: string): string => {
  const [, type, slot, n] = altKey.split(".");
  return (getDictionary(locale).console.defaultMedia as Record<string, Record<string, Record<string, string>>>)[type!]![slot!]![n!]!;
};

/** The proposals of the offered trades, built from the manifest (a file the manifest lacks is left out). */
export function proposalsFor(types: readonly ShopType[] = SHOP_TYPES): Record<ShopType, Proposals> {
  const out = {} as Record<ShopType, Proposals>;
  for (const type of types) {
    const video = defaultsFor(type, "cover").map(defaultVideo).find((v) => v !== null) ?? null;
    out[type] = {
      cover: video ? { id: video.id, src: video.poster, webm: video.webm, mp4: video.mp4, altFr: alt("fr", video.altKey), altEn: alt("en", video.altKey) } : null,
      gallery: defaultsFor(type, "gallery").map(defaultImage).filter((i) => i !== null).map((i) => ({ id: i.id, src: i.src, altFr: alt("fr", i.altKey), altEn: alt("en", i.altKey) })),
    };
  }
  return out;
}
