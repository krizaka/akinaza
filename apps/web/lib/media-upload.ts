import { createHash } from "node:crypto";

/**
 * The owner's photos for the storefront (cover, gallery): checked by their bytes, stored content-hashed on the media
 * storage under `user/akinaza/shops/<shop>/`, and answered as a CDN address — the only thing the database keeps. Off
 * (fails closed) until the storage is configured.
 */
// @fixed: the largest upload the server takes (the phone redraws a photo at 1920 px as a JPEG first, ~0.5–1.5 MB) — an abuse limit.
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export interface MediaSettings {
  apiKey: string;
  zone: string;
  endpoint: string;
  cdn: string;
}

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

export function mediaSettings(source: Record<string, string | undefined> = process.env): MediaSettings | null {
  const apiKey = source.MEDIA_STORAGE_API_KEY?.trim();
  const zone = source.MEDIA_STORAGE_ZONE?.trim();
  const cdn = source.MEDIA_CDN_HOSTNAME?.trim();
  if (!apiKey || !zone || !cdn) return null;
  return { apiKey, zone, endpoint: source.MEDIA_STORAGE_ENDPOINT?.trim() || "storage.bunnycdn.com", cdn };
}

const starts = (bytes: Uint8Array, magic: number[], at = 0) => magic.every((b, i) => bytes[at + i] === b);

/** The image kind from its first bytes (JPEG, PNG, WebP); an SVG, HTML, a GIF or an empty file is `null`. */
export function detectImage(bytes: Uint8Array): { ext: "jpg" | "png" | "webp"; mime: string } | null {
  if (starts(bytes, [0xff, 0xd8, 0xff])) return { ext: "jpg", mime: "image/jpeg" };
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: "png", mime: "image/png" };
  if (starts(bytes, [0x52, 0x49, 0x46, 0x46]) && starts(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return { ext: "webp", mime: "image/webp" };
  return null;
}

export function uploadKey(shopId: string, bytes: Uint8Array, ext: string, purpose: MediaPurpose = "gallery"): string {
  return `${mediaPrefix(shopId, purpose)}${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}.${ext}`;
}

/** Sends the image to the storage zone and returns its CDN address. The access key never leaves this function. */
export async function storeImage(settings: MediaSettings, shopId: string, bytes: Uint8Array, fetchImpl: typeof fetch = fetch, purpose: MediaPurpose = "gallery"): Promise<string> {
  const kind = detectImage(bytes);
  if (!kind) throw new Error("not an image");
  const key = uploadKey(shopId, bytes, kind.ext, purpose);
  const response = await fetchImpl(`https://${settings.endpoint}/${settings.zone}/${key}`, { method: "PUT", headers: { AccessKey: settings.apiKey, "content-type": kind.mime }, body: bytes as unknown as BodyInit });
  if (!response.ok) throw new Error(`media storage refused (${response.status})`);
  return `https://${settings.cdn}/${key}`;
}

// @fixed: the largest file attached to a client's request (a photo redrawn by the phone, or a short PDF) — an abuse limit.
export const MAX_REQUEST_FILE_BYTES = 5 * 1024 * 1024;

/** What a client may attach to a request (akinaza#210): a JPEG, PNG or WebP image, or a PDF — by its bytes, never its name. */
export function detectRequestFile(bytes: Uint8Array): { ext: "jpg" | "png" | "webp" | "pdf"; mime: string; kind: "image" | "pdf" } | null {
  const image = detectImage(bytes);
  if (image) return { ...image, kind: "image" };
  if (starts(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { ext: "pdf", mime: "application/pdf", kind: "pdf" };
  return null;
}

export function requestFileKey(shopId: string, requestId: string, bytes: Uint8Array, ext: string): string {
  return `user/akinaza/shops/${shopId}/requests/${requestId}/${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}.${ext}`;
}

/** Sends a request's file to the storage zone and returns its CDN address and kind. The access key never leaves this function. */
export async function storeRequestFile(settings: MediaSettings, shopId: string, requestId: string, bytes: Uint8Array, fetchImpl: typeof fetch = fetch): Promise<{ url: string; kind: "image" | "pdf" }> {
  const file = detectRequestFile(bytes);
  if (!file) throw new Error("not an image or a PDF");
  const key = requestFileKey(shopId, requestId, bytes, file.ext);
  const response = await fetchImpl(`https://${settings.endpoint}/${settings.zone}/${key}`, { method: "PUT", headers: { AccessKey: settings.apiKey, "content-type": file.mime }, body: bytes as unknown as BodyInit });
  if (!response.ok) throw new Error(`media storage refused (${response.status})`);
  return { url: `https://${settings.cdn}/${key}`, kind: file.kind };
}

/**
 * Removes a stored file by its CDN address (a deleted request, an erased client). Only an address of this zone's CDN under
 * `user/akinaza/` is accepted: nothing else can be deleted through it. Answers whether the storage removed it (a file already
 * gone counts as removed).
 */
export async function deleteStored(settings: MediaSettings, url: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const prefix = `https://${settings.cdn}/`;
  if (!url.startsWith(prefix)) return false;
  const key = url.slice(prefix.length);
  if (!key.startsWith("user/akinaza/") || key.includes("..")) return false;
  const response = await fetchImpl(`https://${settings.endpoint}/${settings.zone}/${key}`, { method: "DELETE", headers: { AccessKey: settings.apiKey } });
  return response.ok || response.status === 404;
}
