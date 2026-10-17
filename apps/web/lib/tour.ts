/**
 * The landing's living proof: the dog walker's real journey on dev.akinaza.com (Pattes de Saint-Henri, a demo shop, the
 * walker Léa and the client Sofia — QA personas, no real person), captured on a phone on 2026-10-17 by the walker-journey
 * run whose request ids are kept below. The stills are the posters (shown first, and the only picture under reduced
 * motion); the 32 s full-frame recording of that journey (Bunny `pr-assets/akinaza/walker-journey/`) is cut into one clip
 * per step, played by StepShowcase once the block is seen. The captions are in the page (messages). On the Krizaka media CDN
 * under hashed, immutable names (`site/products/akinaza/tour/phone-<step>.<hash>.jpg`, `<step>.<hash>.{mp4,webm}`, a prefix
 * owned by this site: FOREIGN_WRITERS in krizaka-com); a new capture is new hashes here and the old files pruned.
 */
/** The Krizaka media CDN — the one host the page's CSP lets serve images (next.config.mjs). */
export const MEDIA_CDN = "https://krizaka-assets.b-cdn.net";

const STEPS = ["shop", "book", "day", "report", "client"] as const;
export type TourStep = (typeof STEPS)[number];

const HASHES: Record<TourStep, string> = {
  shop: "1fcfa364d8",
  book: "c9c055409e",
  day: "6070dba224",
  report: "af3aa7b92b",
  client: "c5b88410f9",
};

const CLIPS: Record<TourStep, { mp4: string; webm: string }> = {
  shop: { mp4: "b5dfb3fe91", webm: "c788837fe4" },
  book: { mp4: "ce210d0850", webm: "6de56d34ed" },
  day: { mp4: "7674c6aee0", webm: "da39288a47" },
  report: { mp4: "b1f25d285f", webm: "47b4fef558" },
  client: { mp4: "7cbb35c7fc", webm: "71ebb61d4a" },
};

export const TOUR = {
  steps: STEPS,
  /** The run the stills show: Sofia's booking (POST /api/me/bookings) and Léa's report sent (POST …/report/send). */
  requests: { booking: "69e16bf9-dac3-4741-8df5-e647952b73a4", reportSent: "1b27d211-64ec-442c-8a3b-99a4cb3eac5f" },
} as const;

export const tourStill = (step: TourStep) => `${MEDIA_CDN}/site/products/akinaza/tour/phone-${step}.${HASHES[step]}.jpg`;

/** The step's recording, cut from the 32 s walker journey (muted, no sound): WebM first, MP4 for Safari. */
export const tourClip = (step: TourStep) => ({
  webm: `${MEDIA_CDN}/site/products/akinaza/tour/${step}.${CLIPS[step].webm}.webm`,
  mp4: `${MEDIA_CDN}/site/products/akinaza/tour/${step}.${CLIPS[step].mp4}.mp4`,
});
