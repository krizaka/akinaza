/**
 * The landing's living proof: the dog walker's real journey on dev.akinaza.com (Pattes de Saint-Henri, a demo shop, the
 * walker Léa and the client Sofia — QA personas, no real person), captured on a phone on 2026-10-17 by the walker-journey
 * run whose request ids are kept below. Stills, not a video, until the recording of that journey lands; the captions are
 * in the page (messages), never burned into the picture. On the Krizaka media CDN under hashed, immutable names
 * (`site/products/akinaza/tour/phone-<step>.<hash>.jpg`); a new capture is new hashes here and the old files pruned.
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

export const TOUR = {
  steps: STEPS,
  /** The run the stills show: Sofia's booking (POST /api/me/bookings) and Léa's report sent (POST …/report/send). */
  requests: { booking: "69e16bf9-dac3-4741-8df5-e647952b73a4", reportSent: "1b27d211-64ec-442c-8a3b-99a4cb3eac5f" },
} as const;

export const tourStill = (step: TourStep) => `${MEDIA_CDN}/site/products/akinaza/tour/phone-${step}.${HASHES[step]}.jpg`;
