import { requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { handle, refuse } from "@/lib/http";
import { mediaStorage } from "@/lib/media-storage";
import { detectImage, MAX_UPLOAD_BYTES, MEDIA_PURPOSES, type MediaPurpose, PURPOSE_FEATURE, storeImage } from "@/lib/media-upload";
import { appSettings } from "@/lib/settings";
import { may } from "@/lib/shop-permissions";

export const dynamic = "force-dynamic";

/**
 * One photo of the owner's storefront: checked by its bytes, stored on the media storage, answered as its CDN address
 * (the page then saves the addresses with /api/walker/media). Off — 503 — until the storage is configured.
 */
export function POST(req: Request) {
  return handle(async () => {
    const { session, shop, role } = await requireShop(req, "catalogue");
    const media = await mediaStorage({ maxBytes: MAX_UPLOAD_BYTES });
    if (!media) throw refuse(503, "UPLOAD_UNAVAILABLE", "media storage is not configured");
    if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 4096) throw refuse(413, "UPLOAD_TOO_LARGE", "file too large");
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw refuse(400, "BAD_REQUEST", "no file");
    const purpose = form?.get("purpose") ?? "gallery";
    if (typeof purpose !== "string" || !MEDIA_PURPOSES.includes(purpose as (typeof MEDIA_PURPOSES)[number])) throw refuse(400, "BAD_REQUEST", "invalid media purpose");
    // What is pinned on the page is the owner's and the manager's; the shop's own brand (its logo) stays the owner's.
    if (purpose === "brand" && !may(role, "settings")) throw refuse(403, "FORBIDDEN", "Your role does not allow this", { permission: "settings" });
    const feature = (PURPOSE_FEATURE as Partial<Record<MediaPurpose, "features.shopWall" | "features.shopReels" | "features.shopAnnouncements">>)[purpose as MediaPurpose];
    if (feature && !(await appSettings().get(feature, { userId: null }))) throw refuse(403, "FEATURE_OFF", "This feature is switched off", { feature });
    if (file.size > MAX_UPLOAD_BYTES) throw refuse(413, "UPLOAD_TOO_LARGE", "file too large");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!detectImage(bytes)) throw refuse(400, "UPLOAD_NOT_IMAGE", "not a JPEG, PNG or WebP image");
    const url = await storeImage(media, shop.id, bytes, purpose as (typeof MEDIA_PURPOSES)[number]);
    await audit({ action: "shop.media_uploaded", actorId: session.account.id, actorLabel: session.account.email, targetId: shop.id, detail: { bytes: bytes.length, purpose }, headers: req.headers });
    return Response.json({ url });
  });
}
