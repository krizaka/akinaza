import { detectVideo } from "@akinaza/core";
import { addUploadedReel } from "@akinaza/db";

import { requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { assertShopFeature, communityLimits, megabytesToBytes } from "@/lib/community";
import { db } from "@/lib/db";
import { handle, refuse } from "@/lib/http";
import { mediaStorage } from "@/lib/media-storage";
import { detectImage, MAX_UPLOAD_BYTES, storeImage, storeVideo } from "@/lib/media-upload";
import { announcePage } from "@/lib/realtime";

export const dynamic = "force-dynamic";

/**
 * A reel of the owner's: an MP4 or a WebM, checked by its bytes (the container's own header gives the duration), bounded by the administrator's
 * `limits.reelSeconds` and `limits.reelMegabytes`, stored content-hashed under `reels/`; only the CDN addresses are kept. 503 until the storage is configured.
 */
export function POST(req: Request) {
  return handle(async () => {
    const { session, shop } = await requireShop(req, "catalogue");
    await assertShopFeature("features.shopReels");
    const limits = await communityLimits();
    const maxBytes = megabytesToBytes(limits.reelMegabytes);
    const media = await mediaStorage({ maxBytes: Math.max(maxBytes, MAX_UPLOAD_BYTES) });
    if (!media) throw refuse(503, "UPLOAD_UNAVAILABLE", "media storage is not configured");
    if (Number(req.headers.get("content-length") ?? 0) > maxBytes + MAX_UPLOAD_BYTES + 65_536) throw refuse(413, "UPLOAD_TOO_LARGE", "file too large");
    const form = await req.formData().catch(() => null);
    const file = form?.get("video");
    if (!(file instanceof File)) throw refuse(400, "BAD_REQUEST", "no video");
    if (file.size > maxBytes) throw refuse(413, "UPLOAD_TOO_LARGE", "file too large", { maxMegabytes: limits.reelMegabytes });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const video = detectVideo(bytes);
    if (!video) throw refuse(400, "UPLOAD_NOT_VIDEO", "not an MP4 or a WebM video");
    if (video.seconds > limits.reelSeconds) throw refuse(413, "REEL_TOO_LONG", "the reel is too long", { maxSeconds: limits.reelSeconds });
    let posterUrl: string | null = null;
    const poster = form?.get("poster");
    if (poster instanceof File && poster.size > 0) {
      if (poster.size > MAX_UPLOAD_BYTES) throw refuse(413, "UPLOAD_TOO_LARGE", "poster too large");
      const posterBytes = new Uint8Array(await poster.arrayBuffer());
      if (!detectImage(posterBytes)) throw refuse(400, "UPLOAD_NOT_IMAGE", "not a JPEG, PNG or WebP image");
      posterUrl = await storeImage(media, shop.id, posterBytes, "reels");
    }
    const url = await storeVideo(media, shop.id, bytes, video.ext);
    const text = (name: string) => { const v = form?.get(name); return typeof v === "string" ? v : ""; };
    const id = await addUploadedReel(db(), shop.id, { mp4Url: video.ext === "mp4" ? url : null, webmUrl: video.ext === "webm" ? url : null, posterUrl, seconds: video.seconds, titleFr: text("titleFr"), titleEn: text("titleEn") });
    await audit({ action: "shop.reel_uploaded", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: { bytes: bytes.length, seconds: video.seconds }, headers: req.headers });
    await announcePage(shop.id);
    return Response.json({ id, url }, { status: 201 });
  });
}
