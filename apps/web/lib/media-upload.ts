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

export function uploadKey(shopId: string, bytes: Uint8Array, ext: string): string {
  return `user/akinaza/shops/${shopId}/${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}.${ext}`;
}

/** Sends the image to the storage zone and returns its CDN address. The access key never leaves this function. */
export async function storeImage(settings: MediaSettings, shopId: string, bytes: Uint8Array, fetchImpl: typeof fetch = fetch): Promise<string> {
  const kind = detectImage(bytes);
  if (!kind) throw new Error("not an image");
  const key = uploadKey(shopId, bytes, kind.ext);
  const response = await fetchImpl(`https://${settings.endpoint}/${settings.zone}/${key}`, { method: "PUT", headers: { AccessKey: settings.apiKey, "content-type": kind.mime }, body: bytes as unknown as BodyInit });
  if (!response.ok) throw new Error(`media storage refused (${response.status})`);
  return `https://${settings.cdn}/${key}`;
}
