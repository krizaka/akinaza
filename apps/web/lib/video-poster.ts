import { posterTime } from "@/lib/reel-order";

// @fixed: the widest a poster frame is drawn, in pixels: a display size, not a business rule.
const POSTER_WIDTH = 720;
// @fixed: the JPEG quality of the poster frame (0-1): an encoder setting.
const POSTER_QUALITY = 0.82;

const waitFor = (target: HTMLVideoElement, event: "loadeddata" | "seeked"): Promise<void> =>
  new Promise((resolve, reject) => {
    target.addEventListener(event, () => resolve(), { once: true });
    target.addEventListener("error", () => reject(new Error("video")), { once: true });
  });

/**
 * A picture taken from the video itself, on the owner's phone, for the owners who pick no poster: the page shows it before the video plays. It is
 * redrawn as a JPEG, so nothing but the picture leaves the phone. Null when the browser cannot read the file (the video then has no poster).
 */
export async function videoPosterFrame(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    await waitFor(video, "loadeddata");
    video.currentTime = posterTime(video.duration);
    await waitFor(video, "seeked");
    const scale = Math.min(1, POSTER_WIDTH / (video.videoWidth || POSTER_WIDTH));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round((video.videoWidth || POSTER_WIDTH) * scale);
    canvas.height = Math.round((video.videoHeight || POSTER_WIDTH) * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", POSTER_QUALITY));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
