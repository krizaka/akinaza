import type { GalleryLine } from "@/lib/storefront-form";

/**
 * What « Images proposées » does to the shop's media (#267), as pure functions: the next state from the current one, and the body the media route takes.
 * The route replaces the cover and the gallery as a whole, so every save carries the whole intended state — threaded from one adoption to the next, never a stale snapshot.
 */
export interface MediaState {
  cover: GalleryLine | null;
  gallery: GalleryLine[];
}

/** A proposal the owner may adopt: the picture, its descriptions, and for a cover its loop. */
export interface Adoptable {
  src: string;
  altFr: string;
  altEn: string;
  webm?: string;
  mp4?: string;
}

/** The most photos a shop page shows: the same bound as the media form and the route. */
// @fixed: the gallery's bound is the media route's (`shopMediaInputSchema`, max 12), not a business parameter
export const GALLERY_MAX = 12;

/** A line as the media route takes it: the loop files and the captions only when present (a `null` would be refused), `wide` always said. */
export function asInput(line: GalleryLine): { url: string; altFr: string; altEn: string; captionFr?: string; captionEn?: string; webmUrl?: string; mp4Url?: string; wide: boolean } {
  return {
    url: line.url,
    altFr: line.altFr,
    altEn: line.altEn,
    ...(line.captionFr ? { captionFr: line.captionFr } : {}),
    ...(line.captionEn ? { captionEn: line.captionEn } : {}),
    ...(line.webmUrl ? { webmUrl: line.webmUrl } : {}),
    ...(line.mp4Url ? { mp4Url: line.mp4Url } : {}),
    wide: line.wide ?? false,
  };
}

/** The body of a save: the whole state, each line as the route takes it. */
export function mediaPayload(media: MediaState): { cover: ReturnType<typeof asInput> | null; gallery: ReturnType<typeof asInput>[] } {
  return { cover: media.cover ? asInput(media.cover) : null, gallery: media.gallery.map(asInput) };
}

/** The proposed cover becomes the shop's, with its loop; the photos stay as they are. */
export function adoptCover(media: MediaState, proposal: Adoptable): MediaState {
  return { cover: { url: proposal.src, altFr: proposal.altFr, altEn: proposal.altEn, ...(proposal.webm ? { webmUrl: proposal.webm } : {}), ...(proposal.mp4 ? { mp4Url: proposal.mp4 } : {}), wide: false }, gallery: media.gallery };
}

/** The proposed picture joins the shop's photos (once, and never past the bound); the cover stays as it is. */
export function addPhoto(media: MediaState, proposal: Adoptable): MediaState {
  if (media.gallery.some((line) => line.url === proposal.src)) return media;
  return { cover: media.cover, gallery: [...media.gallery, { url: proposal.src, altFr: proposal.altFr, altEn: proposal.altEn, wide: false }].slice(0, GALLERY_MAX) };
}
