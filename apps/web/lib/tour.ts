/**
 * The landing's living proof: the dog walker's real journey on dev.akinaza.com (Pattes de Saint-Henri, a demo shop, the
 * walker Léa and the client Sofia — QA personas, no real person), recorded on a phone on 2026-10-19 as ONE continuous take (scripts/record-journey.mjs: a Chrome DevTools screencast,
 * ~56 fps captured, 30 fps encoded), in French and in English. The stills are the posters (shown first, and the only picture under reduced
 * motion); the 32 s full-frame recording of that journey (Bunny `pr-assets/akinaza/walker-journey/`) is cut into one clip
 * per step, played by StepShowcase once the block is seen. The captions are in the page (messages). On the Krizaka media CDN
 * under hashed, immutable names (`site/products/akinaza/tour/phone-<step>.<hash>.jpg`, `<step>.<hash>.{mp4,webm}`, a prefix
 * owned by this site: FOREIGN_WRITERS in krizaka-com); a new capture is new hashes here and the old files pruned.
 */
/** The Krizaka media CDN — the one host the page's CSP lets serve images (next.config.mjs). */
export const MEDIA_CDN = "https://krizaka-assets.b-cdn.net";

const STEPS = ["book", "day", "report", "client", "books"] as const;
export type TourStep = (typeof STEPS)[number];
export type TourLocale = "en" | "fr";

/** The step's poster (a frame of the take), by language: `phone-<step>-<locale>.<hash>.jpg`. */
const STILLS: Record<TourLocale, Record<TourStep, string>> = {
  fr: { book: "ef4b07067c", day: "3a569bac82", report: "c10f07d478", client: "6b1ffee95e", books: "2ecb4af262" },
  en: { book: "da40382afd", day: "ec6fa60d4c", report: "54c1be7644", client: "8c4fbc1b24", books: "f6842e6747" },
};

/** The step's recording, cut from the same take: `<step>-<locale>.<hash>.{webm,mp4}`. */
const CLIPS: Record<TourLocale, Record<TourStep, { mp4: string; webm: string }>> = {
  fr: {
    book: { mp4: "83dc8cb7f2", webm: "0f784ab1c8" },
    day: { mp4: "a7c96828c3", webm: "6de48bb177" },
    report: { mp4: "0868871ac1", webm: "ecc12d58c7" },
    client: { mp4: "c8ebbdc9ea", webm: "386b6b4390" },
    books: { mp4: "2e6bafce27", webm: "e086bd0f86" },
  },
  en: {
    book: { mp4: "2629046ec2", webm: "674b1c5efb" },
    day: { mp4: "6eb5fa6605", webm: "ca28a397bc" },
    report: { mp4: "81d6afdc04", webm: "6308d3f5a7" },
    client: { mp4: "944cbd8f60", webm: "3e20fe4223" },
    books: { mp4: "f5ba999860", webm: "c232bffaed" },
  },
};

/** The whole take, for the hero's phone (muted loop): `hero-<locale>.<hash>.{webm,mp4}`, its poster `phone-hero-<locale>.<hash>.jpg`. */
const HERO: Record<TourLocale, { mp4: string; webm: string; poster: string }> = {
  fr: { mp4: "738ee3ab75", webm: "c5868a084e", poster: "ef4b07067c" },
  en: { mp4: "879d9c259f", webm: "9b62beffcb", poster: "da40382afd" },
};

export const TOUR = {
  steps: STEPS,
  /** The first run's proof (2026-10-17): Sofia's booking (POST /api/me/bookings) and Léa's report sent (POST …/report/send). */
  requests: { booking: "69e16bf9-dac3-4741-8df5-e647952b73a4", reportSent: "1b27d211-64ec-442c-8a3b-99a4cb3eac5f" },
} as const;

const TOUR_DIR = `${MEDIA_CDN}/site/products/akinaza/tour`;

export const tourStill = (step: TourStep, locale: TourLocale) => `${TOUR_DIR}/phone-${step}-${locale}.${STILLS[locale][step]}.jpg`;

/** The step's recording (muted, no sound): WebM first, MP4 for Safari. */
export const tourClip = (step: TourStep, locale: TourLocale) => ({
  webm: `${TOUR_DIR}/${step}-${locale}.${CLIPS[locale][step].webm}.webm`,
  mp4: `${TOUR_DIR}/${step}-${locale}.${CLIPS[locale][step].mp4}.mp4`,
});

/**
 * The hero's phone: the continuous take of the product on dev.akinaza.com — the storefront, a booking, the walker's day, the
 * report, what the client receives, « Vos livres » — a muted loop whose poster (the storefront's first second) is the page's LCP.
 * 780 × 1688 (390 × 844 at 2×); the video itself is 540 px wide.
 */
export const HERO_TAKE = { width: 780, height: 1688 } as const;
export const heroTake = (locale: TourLocale) => ({
  poster: `${TOUR_DIR}/phone-hero-${locale}.${HERO[locale].poster}.jpg`,
  webm: `${TOUR_DIR}/hero-${locale}.${HERO[locale].webm}.webm`,
  mp4: `${TOUR_DIR}/hero-${locale}.${HERO[locale].mp4}.mp4`,
});
