import { currentAnnouncements, type ReelTransition, reviewScore, type ScoreRules, WALL_KIND, type WallTexture } from "@akinaza/core";
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
  /** On the neighbourhood feed: the shop that pinned it, so the flyer leads to its page. Absent on the shop's own board. */
  shop?: { name: string; href: string };
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
  /** The first video of the owner's playlist. */
  tv: VideoView | null;
  /** The television's programmes, in the owner's order (their own videos, and links behind a facade). */
  playlist: VideoView[];
  /** How the television passes from one programme to the next. */
  transition: ReelTransition;
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
export const dayOf = (day: string, locale: Locale) => new Intl.DateTimeFormat(lang(locale), { timeZone: "UTC", day: "numeric", month: "long" }).format(new Date(`${day}T12:00:00Z`));
const numberOf = (n: number, locale: Locale) => new Intl.NumberFormat(lang(locale), { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(n);

const tvPlaceOf = (wallOn: boolean) => (wallOn ? "wall" : "reels");
const plural = <T extends string>(count: number, one: T, other: T): T => (count === 1 ? one : other);

/** The score and the latest verified reviews, or null under the administrator's minimum. */
function reviewsView({ community, locale, rules }: Readonly<{ community: CommunityView; locale: Locale; rules: ScoreRules }>): ReviewsView | null {
  const t = translator(locale);
  const result = reviewScore(community.reviews, rules);
  if (!result.shown || result.score === null) {
    return null;
  }
  const shownScore = numberOf(result.score, locale);
  const d = result.distribution;
  return {
    score: result.score,
    count: result.count,
    distribution: [d[1], d[2], d[3], d[4], d[5]],
    minCount: rules.minCount,
    scoreText: t("console.shopPage.reviewScore", { score: shownScore }),
    countText: t(plural(result.count, "console.shopPage.reviewCountOne", "console.shopPage.reviewCountOther"), { count: result.count }),
    summaryText: t(plural(result.count, "console.shopPage.reviewSummaryOne", "console.shopPage.reviewSummaryOther"), { score: shownScore, count: result.count }),
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

export function buildCommunity(input: { community: CommunityView; locale: Locale; today: string; rules: ScoreRules; enabled: Record<"wall" | "reels" | "announcements" | "reviews", boolean> }): CommunityPublicView {
  const { community, locale, today, rules, enabled } = input;
  const t = translator(locale);
  const say = (fr: string, en: string) => ({ fr, en })[locale] || fr || en;

  const blank = { attachment: "tape" as const, imageUrl: null, alt: "", caption: "", text: "", signature: "", variant: "enamel" as const };
  const pieceOf = (item: CommunityView["wall"]["items"][number]): WallPiece => {
    const place = { id: item.id, x: item.x, y: item.y, rotation: item.rotation, z: item.z };
    switch (item.kind) {
      case WALL_KIND.polaroid:
        return { ...blank, ...place, kind: item.kind, attachment: item.attachment, imageUrl: item.imageUrl, alt: say(item.altFr, item.altEn), caption: say(item.captionFr, item.captionEn) };
      case WALL_KIND.note:
        return { ...blank, ...place, kind: item.kind, attachment: item.attachment, text: say(item.textFr, item.textEn), signature: item.signature };
      default:
        return { ...blank, ...place, kind: item.kind, variant: item.variant };
    }
  };
  const pieces: WallPiece[] = community.wall.items.map(pieceOf);

  const video = (r: CommunityView["reels"][number]): VideoView => ({ id: r.id, title: say(r.titleFr, r.titleEn), mp4: r.mp4Url, webm: r.webmUrl, poster: r.posterUrl, platform: r.platform, externalUrl: r.externalUrl });
  const reels = enabled.reels ? community.reels.map(video) : [];
  const playlist = reels.filter((r) => r.mp4 || r.webm || r.externalUrl);
  const tv = playlist[0] ?? null;
  const elsewhere = reels.filter((r) => r.platform && r.id !== tv?.id).slice(0, SHOWN.elsewhere);

  const links = enabled.reels
    ? (Object.entries(community.links) as [string, string][]).map(([platform, url]) => ({ platform, url, label: t(`console.shopPage.social.${platform}` as never, {} as never) }))
    : [];

  const flyers = enabled.announcements
    ? currentAnnouncements(community.announcements, today).map((a) => ({ id: a.id, text: say(a.textFr, a.textEn), until: a.endsOn ? t("console.shopPage.flyerUntil", { day: dayOf(a.endsOn, locale) }) : null }))
    : [];

  const reviews = enabled.reviews ? reviewsView({ community, locale, rules }) : null;

  const wall = enabled.wall && pieces.length > 0 ? { texture: community.wall.texture, pieces } : null;
  const tvPlace = tv ? tvPlaceOf(enabled.wall) : null;
  return { wall, tv, playlist, transition: community.reelTransition, tvPlace, elsewhere, links, flyers, reviews, has: { wall: wall !== null || tvPlace === "wall", reels: tvPlace === "reels" || elsewhere.length > 0 || links.length > 0, announcements: flyers.length > 0, reviews: reviews !== null } };
}
