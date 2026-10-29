/**
 * The landing's living proof, captured on a demo shop (Krizaka (démo), Éric's studio: fictional, seeded, QA personas, no real
 * person). The hero's phone plays one take of it (2026-10-29, scripts/record-hero.mjs: the notebook storefront, Today, an invoice, the books; Éric is a persona, never the administrator);
 * the three screens under it are stills of the booking page, an invoice and the quarter's books. All on the Krizaka media CDN under
 * hashed, immutable names (`sites/akinaza/tour/`, a prefix owned by this site: FOREIGN_WRITERS in krizaka-com);
 * a new capture is a new hash here.
 */
/** The Krizaka media CDN: the one host the page's CSP lets serve images (lib/csp.ts). */
export const MEDIA_CDN = "https://krizaka-assets.b-cdn.net";

export type TourLocale = "en" | "fr";

/** The three screens of the home, by language: a real capture of the app on a phone (`phone-<screen>-<locale>.<hash>.jpg`). */
const SCREEN_STILLS = {
  book: { fr: "2c2e266324", en: "faaf9e3bb6" },
  invoice: { fr: "dc44a4adf0", en: "9d8fa386d4" },
  books: { fr: "cc36ea692f", en: "de10724a56" },
} as const;
export type ScreenId = keyof typeof SCREEN_STILLS;

/** The whole take, for the hero's phone (muted loop): `hero-<locale>.<hash>.{webm,mp4}`, its poster `phone-hero-<locale>.<hash>.jpg`. */
const HERO: Record<TourLocale, { mp4: string; webm: string; poster: string }> = {
  fr: { mp4: "5a60fcbb59", webm: "37a823a1c5", poster: "bc22c28267" },
  en: { mp4: "9cba68ab85", webm: "1006f217d2", poster: "f56e98e080" },
};

const TOUR_DIR = `${MEDIA_CDN}/sites/akinaza/tour`;

export const screenStill = (id: ScreenId, locale: TourLocale) => `${TOUR_DIR}/phone-${id}-${locale}.${SCREEN_STILLS[id][locale]}.jpg`;

/**
 * The hero's phone: the continuous take of the product — the notebook storefront, Today, an invoice, « Vos livres » — a muted loop whose poster (the storefront's first second) is the page's LCP.
 * 780 × 1688 (390 × 844 at 2×); the video itself is 540 px wide.
 */
export const HERO_TAKE = { width: 780, height: 1688 } as const;
export const heroTake = (locale: TourLocale) => ({
  poster: `${TOUR_DIR}/phone-hero-${locale}.${HERO[locale].poster}.jpg`,
  webm: `${TOUR_DIR}/hero-${locale}.${HERO[locale].webm}.webm`,
  mp4: `${TOUR_DIR}/hero-${locale}.${HERO[locale].mp4}.mp4`,
});
