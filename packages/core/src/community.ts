import { z } from "zod";

/**
 * The shop as a place (akinaza#236, B45): what the owner pins on the public page — the wall, the reel, the bulletin board, the profile links — and
 * the clients' reviews with their score. Pure and deterministic: every bound lives here once, the database and the routes read it. The reviews
 * are a small read model until `@krizaka/reviews` (krizaka-ts#37) is published; its score is the same Bayesian average.
 */

export const WALL_TEXTURES = ["brick", "zellige", "ridge", "plaster"] as const;
export type WallTexture = (typeof WALL_TEXTURES)[number];
export const WALL_KINDS = ["polaroid", "note", "sign"] as const;
export const WALL_KIND = { polaroid: "polaroid", note: "note", sign: "sign" } as const;
export const SIGN_VARIANTS = ["enamel", "neon", "painted"] as const;
export const ATTACHMENTS = ["tape", "pin"] as const;

// @fixed: the design's limits that keep every shop beautiful (docs/design/cahier-storefront.md § 5.3): the wall draws twelve items, a caption is 40 characters, a card 140, a tilt 8 degrees.
export const WALL_LIMITS = { drawn: 12, caption: 40, note: 140, alt: 200, signature: 40, tilt: 8, order: 1000 } as const;
// @fixed: the same section: a flyer is 500 characters, three are pinned at a time.
export const ANNOUNCEMENT_LIMITS = { text: 500, current: 3 } as const;
// @fixed: a review is a short word; the owner's reply is as long.
export const REVIEW_LIMITS = { text: 1000, reply: 1000, name: 40, service: 120 } as const;

const httpsUrl = z.string().max(500).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}, { message: "https only" });

const place = {
  x: z.number().finite().min(0).max(100),
  y: z.number().finite().min(0).max(100),
  rotation: z.number().finite().min(-WALL_LIMITS.tilt).max(WALL_LIMITS.tilt).default(0),
  z: z.number().int().min(0).max(WALL_LIMITS.order),
};
const attachment = z.enum(ATTACHMENTS).default("tape");
const alt = z.string().max(WALL_LIMITS.alt);
const caption = z.string().max(WALL_LIMITS.caption);
const eitherLanguage = (fr: string, en: string) => fr.trim().length > 0 || en.trim().length > 0;

export const wallItemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("polaroid"), ...place, attachment, imageUrl: httpsUrl, altFr: alt, altEn: alt, captionFr: caption.default(""), captionEn: caption.default("") })
    .refine((item) => eitherLanguage(item.altFr, item.altEn), { message: "A photo needs its alternative text", path: ["altFr"] }),
  z.object({ kind: z.literal("note"), ...place, attachment, textFr: z.string().max(WALL_LIMITS.note), textEn: z.string().max(WALL_LIMITS.note), signature: z.string().max(WALL_LIMITS.signature).default("") })
    .refine((item) => eitherLanguage(item.textFr, item.textEn), { message: "A card needs a word", path: ["textFr"] }),
  z.object({ kind: z.literal("sign"), ...place, variant: z.enum(SIGN_VARIANTS).default("enamel") }),
]);
export type WallItem = z.infer<typeof wallItemSchema>;

/** The whole wall as the owner saves it: a texture and at most `max` items (`limits.wallItems`). */
export const wallSchema = (max: number) => z.object({ texture: z.enum(WALL_TEXTURES), items: z.array(wallItemSchema).max(max) });
export type WallInput = z.infer<ReturnType<typeof wallSchema>>;

// ---- reviews -------------------------------------------------------------------------------------------------------------------------------------

export const REVIEW_STATES = ["published", "hidden_by_owner", "removed_by_admin", "pending"] as const;
export const REVIEW_STATE = { published: "published", hiddenByOwner: "hidden_by_owner", removedByAdmin: "removed_by_admin", pending: "pending" } as const;
export interface ScoredReview {
  rating: number;
  verified: boolean;
  state: string;
}
export interface ScoreRules {
  /** The prior mean `m`. */
  prior: number;
  /** Its weight `C`, in reviews. */
  weight: number;
  /** Below this many counted reviews nothing is shown. */
  minCount: number;
}
export interface ReviewScore {
  count: number;
  /** One decimal; null with no review. */
  score: number | null;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  shown: boolean;
}

/** `(C·m + Σr) / (C + n)` over the published, verified reviews only: a lone five-star word does not make a five-star shop. */
export function reviewScore(reviews: readonly ScoredReview[], rules: ScoreRules): ReviewScore {
  const counted = reviews.filter((r) => r.verified && r.state === REVIEW_STATE.published && Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as ReviewScore["distribution"];
  for (const r of counted) distribution[r.rating as 1 | 2 | 3 | 4 | 5] += 1;
  const count = counted.length;
  const sum = counted.reduce((n, r) => n + r.rating, 0);
  const score = count === 0 ? null : Math.round(((rules.weight * rules.prior + sum) / (rules.weight + count)) * 10) / 10;
  return { count, score, distribution, shown: count >= rules.minCount && count > 0 };
}

// ---- the bulletin board --------------------------------------------------------------------------------------------------------------------------

/** The flyers still up on `today` (the shop's local day, `YYYY-MM-DD`): no end date, or an end date not yet passed; newest first, at most three. */
export function currentAnnouncements<T extends { endsOn: string | null; createdAt: Date }>(list: readonly T[], today: string): T[] {
  return list
    .filter((a) => a.endsOn === null || a.endsOn >= today)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, ANNOUNCEMENT_LIMITS.current);
}

// ---- the reel and the profile links --------------------------------------------------------------------------------------------------------------

export const EMBED_PLATFORMS = ["tiktok", "youtube-shorts", "instagram"] as const;
export type EmbedPlatform = (typeof EMBED_PLATFORMS)[number];
export interface ExternalReel {
  platform: EmbedPlatform;
  /** The page of the video on the platform: where the facade's link leads. */
  url: string;
  /** The address of the player, loaded only after the visitor clicked. */
  embedUrl: string;
}

const strict = (value: string): URL | null => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port ? url : null;
  } catch {
    return null;
  }
};

/** A TikTok video, a YouTube Short or an Instagram reel — by an exact host and a strict path, nothing else (no redirect target, no look-alike host, no port, no credentials). */
export function externalReel(value: string): ExternalReel | null {
  const url = strict(value);
  if (!url) return null;
  const host = url.hostname.toLowerCase();
  if (host === "www.tiktok.com" || host === "tiktok.com") {
    const id = /^\/@[\w.]{1,40}\/video\/(\d{8,25})\/?$/.exec(url.pathname)?.[1];
    return id ? { platform: "tiktok", url: `https://www.tiktok.com${url.pathname.replace(/\/$/, "")}`, embedUrl: `https://www.tiktok.com/embed/v2/${id}` } : null;
  }
  if (host === "www.youtube.com" || host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
    const id = host === "youtu.be" ? /^\/([\w-]{11})\/?$/.exec(url.pathname)?.[1] : /^\/shorts\/([\w-]{11})\/?$/.exec(url.pathname)?.[1];
    return id ? { platform: "youtube-shorts", url: `https://www.youtube.com/shorts/${id}`, embedUrl: `https://www.youtube-nocookie.com/embed/${id}` } : null;
  }
  if (host === "www.instagram.com" || host === "instagram.com") {
    const id = /^\/(?:reel|reels|p)\/([\w-]{5,20})\/?$/.exec(url.pathname)?.[1];
    return id ? { platform: "instagram", url: `https://www.instagram.com/reel/${id}/`, embedUrl: `https://www.instagram.com/reel/${id}/embed` } : null;
  }
  return null;
}

export const SOCIAL_PLATFORMS = ["tiktok", "youtube", "instagram", "facebook"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
const SOCIAL_HOSTS: Record<SocialPlatform, readonly string[]> = {
  tiktok: ["www.tiktok.com", "tiktok.com"],
  youtube: ["www.youtube.com", "youtube.com", "m.youtube.com"],
  instagram: ["www.instagram.com", "instagram.com"],
  facebook: ["www.facebook.com", "facebook.com", "m.facebook.com"],
};

/** A profile address on its own platform, https, 300 characters at most; the address as given, or null. */
export function socialLink(platform: SocialPlatform, value: string): string | null {
  const url = strict(value);
  if (!url || value.length > 300 || !SOCIAL_HOSTS[platform].includes(url.hostname.toLowerCase())) return null;
  return value;
}

// ---- a reel uploaded -----------------------------------------------------------------------------------------------------------------------------

export interface DetectedVideo {
  ext: "mp4" | "webm";
  mime: "video/mp4" | "video/webm";
  /** Read from the container's own header, never from the file name or the browser. */
  seconds: number;
}

const be32 = (b: Uint8Array, at: number) => ((b[at]! * 2 ** 24) + (b[at + 1]! << 16) + (b[at + 2]! << 8) + b[at + 3]!);
const be64 = (b: Uint8Array, at: number) => be32(b, at) * 2 ** 32 + be32(b, at + 4);
const tag = (b: Uint8Array, at: number) => String.fromCodePoint(b[at]!, b[at + 1]!, b[at + 2]!, b[at + 3]!);

/** One MP4 box at `at`: its type, where its body starts and where it ends; null when it does not fit in `to`. */
function mp4Box(b: Uint8Array, at: number, to: number): { type: string; body: number; end: number } | null {
  let size = be32(b, at);
  let header = 8;
  if (size === 1) {
    size = be64(b, at + 8);
    header = 16;
  } else if (size === 0) size = to - at;
  if (size < header || at + size > to) return null;
  return { type: tag(b, at + 4), body: at + header, end: at + size };
}

/** The duration stated by a `mvhd` box whose body starts at `body`. */
function mvhdSeconds(b: Uint8Array, body: number): number | null {
  const long = b[body] === 1;
  const timescale = long ? be32(b, body + 20) : be32(b, body + 12);
  const duration = long ? be64(b, body + 24) : be32(b, body + 16);
  return timescale > 0 ? duration / timescale : null;
}

function mp4Seconds(b: Uint8Array): number | null {
  const walk = (from: number, to: number, inMoov: boolean): number | null => {
    let at = from;
    while (at + 8 <= to) {
      const box = mp4Box(b, at, to);
      if (!box) return null;
      if (inMoov && box.type === "mvhd") return mvhdSeconds(b, box.body);
      const inner = !inMoov && box.type === "moov" ? walk(box.body, box.end, true) : null;
      if (inner !== null) return inner;
      at = box.end;
    }
    return null;
  };
  return walk(0, b.length, false);
}

function readVint(b: Uint8Array, at: number, keepMarker: boolean): { value: number; length: number; unknown: boolean } | null {
  const first = b[at];
  if (first === undefined || first === 0) return null;
  let length = 1;
  while (!(first & (0x80 >> (length - 1)))) length += 1;
  if (at + length > b.length) return null;
  let value = keepMarker ? first : first & (0xff >> length);
  let unknown = !keepMarker && (first & (0xff >> length)) === (0xff >> length);
  for (let i = 1; i < length; i++) {
    value = value * 256 + b[at + i]!;
    if (b[at + i] !== 0xff) unknown = false;
  }
  return { value, length, unknown };
}

const EBML = 0x1a45dfa3;
const SEGMENT = 0x18538067;
const INFO = 0x1549a966;
const TIMECODE_SCALE = 0x2ad7b1;
const DURATION = 0x4489;

const uintOf = (b: Uint8Array, from: number, to: number) => {
  let v = 0;
  for (let i = from; i < to; i++) v = v * 256 + b[i]!;
  return v;
};

const floatOf = (b: Uint8Array, from: number, to: number) => {
  const view = new DataView(b.buffer, b.byteOffset + from, to - from);
  return to - from === 4 ? view.getFloat32(0) : view.getFloat64(0);
};

function webmSeconds(b: Uint8Array): number | null {
  let scale = 1_000_000;
  let duration: number | null = null;
  const walk = (from: number, to: number, depth: number) => {
    let at = from;
    while (at < to && duration === null && depth < 3) {
      const id = readVint(b, at, true);
      const size = id ? readVint(b, at + id.length, false) : null;
      if (!id || !size) return;
      const body = at + id.length + size.length;
      const end = size.unknown ? to : Math.min(to, body + size.value);
      if (id.value === SEGMENT || id.value === INFO) walk(body, end, depth + 1);
      if (id.value === TIMECODE_SCALE) scale = uintOf(b, body, end);
      if (id.value === DURATION && (end - body === 4 || end - body === 8)) duration = floatOf(b, body, end);
      if (size.unknown) return;
      at = end;
    }
  };
  walk(0, Math.min(b.length, 1_000_000), 0);
  return duration === null ? null : (duration * scale) / 1e9;
}

/** An MP4 or a WebM by its first bytes, with the duration its header states; anything else (an image, a script, a truncated file) is null. */
export function detectVideo(bytes: Uint8Array): DetectedVideo | null {
  if (bytes.length >= 12 && tag(bytes, 4) === "ftyp") {
    const seconds = mp4Seconds(bytes);
    return seconds !== null && Number.isFinite(seconds) && seconds > 0 ? { ext: "mp4", mime: "video/mp4", seconds } : null;
  }
  if (bytes.length >= 4 && be32(bytes, 0) === EBML) {
    const seconds = webmSeconds(bytes);
    return seconds !== null && Number.isFinite(seconds) && seconds > 0 ? { ext: "webm", mime: "video/webm", seconds } : null;
  }
  return null;
}
