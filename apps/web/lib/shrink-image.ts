/**
 * A phone's photo is 3–8 MB; the report takes 1.5 MB at most (and the owner's mail should stay light). The picture is
 * redrawn on the phone at 1280 px on its long side as a JPEG before it is sent — orientation applied, location data
 * dropped by the redraw. The server checks the bytes again; this only keeps the upload small.
 */
// @fixed: the longest side of a report photo, in pixels — a display size, not a business rule.
const LONG_SIDE = 1280;
// @fixed: the longest side of a storefront photo (a cover shows at 1600 px) — a display size.
export const STOREFRONT_LONG_SIDE = 1920;
// @fixed: JPEG quality of the redraw (0–1) — an encoder setting.
const QUALITY = 0.82;

export async function shrinkImage(file: File, longSide: number = LONG_SIDE): Promise<Blob> {
  if (typeof createImageBitmap !== "function") return file;
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, longSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", QUALITY));
}
