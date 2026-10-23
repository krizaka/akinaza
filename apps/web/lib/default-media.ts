import { DEFAULT_SLOTS, type DefaultMedia, defaultsFor, type DefaultSlot, type ShopType } from "@akinaza/core";

import manifest from "./default-media.manifest.json";

/**
 * The default images and videos of the storefronts (#267): files on the media CDN, named by `default-media.manifest.json` (logical path -> the first 10 hex of the file's
 * SHA-256, written by `scripts/default-media/build.mjs`; the URL never changes content). The data (which types and slots, which paths) is in `@akinaza/core`.
 */
const files = manifest.files as Record<string, string>;

/** The CDN address of a logical path, or null when the manifest does not name it (never a guessed URL). */
export function defaultFileUrl(path: string): string | null {
  const hash = files[path];
  if (!hash) return null;
  const dot = path.lastIndexOf(".");
  return `${manifest.cdn}/${manifest.root}/${path.slice(0, dot)}.${hash}${path.slice(dot)}`;
}

export interface DefaultImage {
  id: string;
  /** The message that describes it (`console.<altKey>`), FR and EN. */
  altKey: string;
  /** The widest WebP, for an `<img src>`. */
  src: string;
  sources: { type: "image/avif" | "image/webp"; srcSet: string }[];
  width: number;
  height: number;
}
export interface DefaultVideo {
  id: string;
  altKey: string;
  poster: string;
  webm: string;
  mp4: string;
}

const RATIO = { "16:9": [16, 9], "4:3": [4, 3], "3:2": [3, 2] } as const;

/** One default as responsive image: AVIF and WebP at every width, or null if the manifest lacks a file of it. */
export function defaultImage(item: DefaultMedia): DefaultImage | null {
  const urls = item.files.images.map((f) => ({ ...f, url: defaultFileUrl(f.path) }));
  if (urls.some((u) => !u.url)) return null;
  const spec = DEFAULT_SLOTS[item.slot];
  const widest = Math.max(...spec.widths);
  const [rw, rh] = RATIO[spec.ratio];
  const srcSet = (format: "avif" | "webp") => urls.filter((u) => u.format === format).map((u) => `${u.url} ${u.width}w`).join(", ");
  return {
    id: item.id,
    altKey: item.altKey,
    src: urls.find((u) => u.format === "webp" && u.width === widest)!.url!,
    sources: [{ type: "image/avif", srcSet: srcSet("avif") }, { type: "image/webp", srcSet: srcSet("webp") }],
    width: widest,
    height: Math.round((widest * rh) / rw),
  };
}

export function defaultVideo(item: DefaultMedia): DefaultVideo | null {
  const video = item.files.video;
  if (!video) return null;
  const [poster, webm, mp4] = [defaultFileUrl(video.poster), defaultFileUrl(video.webm), defaultFileUrl(video.mp4)];
  return poster && webm && mp4 ? { id: item.id, altKey: item.altKey, poster, webm, mp4 } : null;
}

export interface ResolvedDefaults {
  cover: DefaultVideo | null;
  gallery: DefaultImage[];
  service: DefaultImage[];
}

/** The defaults of a shop type, ready for the page: what the manifest names, in order. */
export function resolveDefaults(type: ShopType): ResolvedDefaults {
  const images = (slot: DefaultSlot) => defaultsFor(type, slot).map(defaultImage).filter((x): x is DefaultImage => x !== null);
  const cover = defaultsFor(type, "cover").map(defaultVideo).find((x): x is DefaultVideo => x !== null) ?? null;
  return { cover, gallery: images("gallery"), service: images("service") };
}
