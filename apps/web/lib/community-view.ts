import { currentAnnouncements, reviewScore, type ScoreRules, type WallTexture } from "@akinaza/core";
import type { CommunityView } from "@akinaza/db";

import { type Locale, translator } from "@/lib/i18n";

/**
 * What the shop's page shows of its community (B45): the wall, the latest reel and the other videos behind their facade, the profile
 * links, the bulletin board and the reviews. Pure: the clock, the language and the administrator's score rules are parameters, the words come
 * from the catalogues. Each part exists only when there is something to show, so a page never carries an empty heading.
 */
export interface WallPiece {
  id: string;
  kind: "polaroid" | "note" | "sign";
  x: number;
  y: number;
  rotation: number;
  z: number;
  attachment: "tape" | "pin";
  imageUrl: string | null;
  alt: string;
  caption: string;
  text: string;
  signature: string;
  variant: "enamel" | "neon" | "painted";
}

export interface VideoView {
  id: string;
  title: string;
  /** The shop's own video. */
  mp4: string | null;
  webm: string | null;
  poster: string | null;
  /** Another channel's video, played only after a click. */
  platform: "tiktok" | "youtube-shorts" | "instagram" | null;
  externalUrl: string | null;
}

export interface FlyerView {
  id: string;
  text: string;
  /** « Until June 3 », or null. */
  until: string | null;
}

export interface ReviewLine {
  id: string;
  author: string;
  date: string;
  dateTime: string;
  service: string;
  rating: number;
  ratingText: string;
  text: string;
  reply: string | null;
}

export interface ReviewsView {
  score: number;
  count: number;
  distribution: [number, number, number, number, number];
  minCount: number;
  scoreText: string;
  countText: string;
  summaryText: string;
  cards: ReviewLine[];
}

export interface CommunityPublicView {
  wall: { texture: WallTexture; pieces: WallPiece[] } | null;
  /** The latest video, in the television. */
  tv: VideoView | null;
  /** Where the television stands: beside the wall, or in the videos section when the wall is off. */
  tvPlace: "wall" | "reels" | null;
  /** The other videos of other channels, each behind its facade. */
  elsewhere: VideoView[];
  links: { platform: string; label: string; url: string }[];
  flyers: FlyerView[];
  reviews: ReviewsView | null;
  /** Which sections have something to show: a section without content is not drawn. */
  has: Record<"wall" | "reels" | "announcements" | "reviews", boolean>;
}

// @fixed: how many reviews and other-channel videos the page lists; the rest stays in the studio.
const SHOWN = { reviews: 3, elsewhere: 2 } as const;

const lang = (locale: Locale) => ({ fr: "fr-CA", en: "en-CA" })[locale];
const monthOf = (at: Date, locale: Locale) => new Intl.DateTimeFormat(lang(locale), { month: "long", year: "numeric" }).format(at);
const dayOf = (day: string, locale: Locale) => new Intl.DateTimeFormat(lang(locale), { timeZone: "UTC", day: "numeric", month: "long" }).format(new Date(`${day}T12:00:00Z`));
const numberOf = (n: number, locale: Locale) => new Intl.NumberFormat(lang(locale), { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(n);

export function buildCommunity(input: { community: CommunityView; locale: Locale; today: string; rules: ScoreRules; enabled: Record<"wall" | "reels" | "announcements" | "reviews", boolean> }): CommunityPublicView {
  const { community, locale, today, rules, enabled } = input;
  const t = translator(locale);
  const say = (fr: string, en: string) => ({ fr, en })[locale] || fr || en;

  const pieces: WallPiece[] = community.wall.items.map((item) => ({
    id: item.id,
    kind: item.kind,
    x: item.x,
    y: item.y,
    rotation: item.rotation,
    z: item.z,
    attachment: item.kind === "sign" ? "tape" : item.attachment,
    imageUrl: item.kind === "polaroid" ? item.imageUrl : null,
    alt: item.kind === "polaroid" ? say(item.altFr, item.altEn) : "",
    caption: item.kind === "polaroid" ? say(item.captionFr, item.captionEn) : "",
    text: item.kind === "note" ? say(item.textFr, item.textEn) : "",
    signature: item.kind === "note" ? item.signature : "",
    variant: item.kind === "sign" ? item.variant : "enamel",
  }));

  const video = (r: CommunityView["reels"][number]): VideoView => ({ id: r.id, title: say(r.titleFr, r.titleEn), mp4: r.mp4Url, webm: r.webmUrl, poster: r.posterUrl, platform: r.platform, externalUrl: r.externalUrl });
  const reels = enabled.reels ? community.reels.map(video) : [];
  const latest = reels[0] ?? null;
  const tv = latest && (latest.mp4 || latest.webm || latest.externalUrl) ? latest : null;
  const elsewhere = reels.filter((r) => r.platform && r.id !== tv?.id).slice(0, SHOWN.elsewhere);

  const links = enabled.reels
    ? (Object.entries(community.links) as [string, string][]).map(([platform, url]) => ({ platform, url, label: t(`console.shopPage.social.${platform}` as never, {} as never) }))
    : [];

  const flyers = enabled.announcements
    ? currentAnnouncements(community.announcements, today).map((a) => ({ id: a.id, text: say(a.textFr, a.textEn), until: a.endsOn ? t("console.shopPage.flyerUntil", { day: dayOf(a.endsOn, locale) }) : null }))
    : [];

  let reviews: ReviewsView | null = null;
  if (enabled.reviews) {
    const result = reviewScore(community.reviews, rules);
    if (result.shown && result.score !== null) {
      const shownScore = numberOf(result.score, locale);
      const d = result.distribution;
      reviews = {
        score: result.score,
        count: result.count,
        distribution: [d[1], d[2], d[3], d[4], d[5]],
        minCount: rules.minCount,
        scoreText: t("console.shopPage.reviewScore", { score: shownScore }),
        countText: t(result.count === 1 ? "console.shopPage.reviewCountOne" : "console.shopPage.reviewCountOther", { count: result.count }),
        summaryText: t(result.count === 1 ? "console.shopPage.reviewSummaryOne" : "console.shopPage.reviewSummaryOther", { score: shownScore, count: result.count }),
        cards: community.reviews.filter((r) => r.verified).slice(0, SHOWN.reviews).map((r) => ({
          id: r.id,
          author: `${r.firstName} ${r.lastInitial}.`,
          date: monthOf(r.createdAt, locale),
          dateTime: r.createdAt.toISOString().slice(0, 7),
          service: r.serviceName,
          rating: r.rating,
          ratingText: t("console.shopPage.reviewRating", { rating: r.rating }),
          text: r.body,
          reply: r.reply || null,
        })),
      };
    }
  }

  const wall = enabled.wall && pieces.length > 0 ? { texture: community.wall.texture, pieces } : null;
  const tvPlace = tv ? (enabled.wall ? "wall" : "reels") : null;
  return { wall, tv, tvPlace, elsewhere, links, flyers, reviews, has: { wall: wall !== null || tvPlace === "wall", reels: tvPlace === "reels" || elsewhere.length > 0 || links.length > 0, announcements: flyers.length > 0, reviews: reviews !== null } };
}
