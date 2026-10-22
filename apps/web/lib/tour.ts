/**
 * The landing's living proof, captured on the demo shop (Pattes de Saint-Henri: fictional, seeded, QA personas, no real
 * person). The hero's phone plays the walker's journey recorded on dev.akinaza.com as one take (2026-10-19, scripts/record-journey.mjs);
 * the three screens under it are stills of the booking, an invoice and the quarter's books. All on the Krizaka media CDN under
 * hashed, immutable names (`site/products/akinaza/tour/`, a prefix owned by this site: FOREIGN_WRITERS in krizaka-com);
 * a new capture is a new hash here.
 */
/** The Krizaka media CDN: the one host the page's CSP lets serve images (next.config.mjs). */
export const MEDIA_CDN = "https://krizaka-assets.b-cdn.net";

export type TourLocale = "en" | "fr";

/** The three screens of the home, by language: a real capture of the app on a phone (`phone-<screen>-<locale>.<hash>.jpg`). */
const SCREEN_STILLS = {
  book: { fr: "ca4f250d6d", en: "fdf7ce2d25" },
  invoice: { fr: "26e50e33ba", en: "85a5b56961" },
  books: { fr: "8ac11dfc7f", en: "12f7de9f2b" },
} as const;
export type ScreenId = keyof typeof SCREEN_STILLS;

/** The whole take, for the hero's phone (muted loop): `hero-<locale>.<hash>.{webm,mp4}`, its poster `phone-hero-<locale>.<hash>.jpg`. */
const HERO: Record<TourLocale, { mp4: string; webm: string; poster: string }> = {
  fr: { mp4: "738ee3ab75", webm: "c5868a084e", poster: "ef4b07067c" },
  en: { mp4: "879d9c259f", webm: "9b62beffcb", poster: "da40382afd" },
};

const TOUR_DIR = `${MEDIA_CDN}/site/products/akinaza/tour`;

export const screenStill = (id: ScreenId, locale: TourLocale) => `${TOUR_DIR}/phone-${id}-${locale}.${SCREEN_STILLS[id][locale]}.jpg`;

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
