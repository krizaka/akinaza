import { sniffType } from "@krizaka/storage";

import { MEDIA_ROOT, type MediaStorage } from "./media-storage";

/**
 * The owner's photos for the storefront (cover, gallery) and the files of a client's request: stored by `@krizaka/storage` (the
 * administrator's provider, the bytes checked by their magic number, content-hashed names) under `user/akinaza/shops/<shop>/…`, and
 * answered as a CDN address — the only thing the database keeps. Off (fails closed) until the storage is configured.
 */
// @fixed: the largest upload the server takes (the phone redraws a photo at 1920 px as a JPEG first, ~0.5–1.5 MB) — an abuse limit.
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export const MEDIA_PURPOSES = ["brand", "wall", "reels", "cards", "announcements", "gallery"] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

const purposeDirectory: Record<MediaPurpose, string> = {
  brand: "brand",
  wall: "wall",
  reels: "reels",
  cards: "cards",
  announcements: "announcements",
  gallery: "gallery",
};

/** The purposes an administrator can switch off (`features.shop*`): the server refuses an upload for what is off, whatever the browser shows. */
export const PURPOSE_FEATURE = {
  wall: "features.shopWall",
  reels: "features.shopReels",
  announcements: "features.shopAnnouncements",
} as const satisfies Partial<Record<MediaPurpose, `features.${string}`>>;

export function mediaPrefix(shopId: string, purpose: MediaPurpose): string {
  return `user/akinaza/shops/${shopId}/${purposeDirectory[purpose]}/`;
}

const IMAGES = ["image/jpeg", "image/png", "image/webp"] as const;
const VIDEOS = ["video/mp4", "video/webm"] as const;
const EXTENSION: Record<string, "jpg" | "png" | "webp" | "pdf"> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

/** The image kind from its first bytes (JPEG, PNG, WebP); an SVG, HTML, a GIF or an empty file is `null`. */
export function detectImage(bytes: Uint8Array): { ext: "jpg" | "png" | "webp"; mime: string } | null {
  const mime = sniffType(bytes);
  return mime && (IMAGES as readonly string[]).includes(mime) ? { ext: EXTENSION[mime] as "jpg" | "png" | "webp", mime } : null;
}

/** Sends the image to the storage and returns its CDN address. */
export async function storeImage(media: MediaStorage, shopId: string, bytes: Uint8Array, purpose: MediaPurpose = "gallery"): Promise<string> {
  const kind = detectImage(bytes);
  if (!kind) throw new Error("not an image");
  const stored = await media.storage.upload({ prefix: MEDIA_ROOT, name: `${shopId}/${purposeDirectory[purpose]}/photo.${kind.ext}`, bytes, allow: IMAGES });
  return addressOf(media, stored.key);
}

/** Sends a reel (an MP4 or a WebM already checked by its bytes), content-hashed under `reels/`, and returns its CDN address. */
export async function storeVideo(media: MediaStorage, shopId: string, bytes: Uint8Array, ext: "mp4" | "webm"): Promise<string> {
  const stored = await media.storage.upload({ prefix: MEDIA_ROOT, name: `${shopId}/${purposeDirectory.reels}/reel.${ext}`, bytes, allow: VIDEOS });
  return addressOf(media, stored.key);
}

// @fixed: the largest file attached to a client's request (a photo redrawn by the phone, or a short PDF) — an abuse limit.
export const MAX_REQUEST_FILE_BYTES = 5 * 1024 * 1024;

/** What a client may attach to a request (akinaza#210): a JPEG, PNG or WebP image, or a PDF — by its bytes, never its name. */
export function detectRequestFile(bytes: Uint8Array): { ext: "jpg" | "png" | "webp" | "pdf"; mime: string; kind: "image" | "pdf" } | null {
  const image = detectImage(bytes);
  if (image) return { ...image, kind: "image" };
  return sniffType(bytes) === "application/pdf" ? { ext: "pdf", mime: "application/pdf", kind: "pdf" } : null;
}

/** Sends a request's file to the storage and returns its CDN address and kind. */
export async function storeRequestFile(media: MediaStorage, shopId: string, requestId: string, bytes: Uint8Array): Promise<{ url: string; kind: "image" | "pdf" }> {
  const file = detectRequestFile(bytes);
  if (!file) throw new Error("not an image or a PDF");
  const stored = await media.storage.upload({ prefix: MEDIA_ROOT, name: `${shopId}/requests/${requestId}/file.${file.ext}`, bytes, allow: [...IMAGES, "application/pdf"] });
  return { url: addressOf(media, stored.key), kind: file.kind };
}

/**
 * Removes a stored file by its CDN address (a deleted request, an erased client). Only an address of this storage's CDN under
 * `user/akinaza/` is accepted: nothing else can be deleted through it. Answers whether the storage removed it (a file already
 * gone counts as removed).
 */
export async function deleteStored(media: MediaStorage, url: string): Promise<boolean> {
  const key = media.keyOf(url);
  if (!key) return false;
  await media.storage.delete(key);
  return true;
}

const addressOf = (media: MediaStorage, key: string) => `https://${media.cdn}/${key}`;
