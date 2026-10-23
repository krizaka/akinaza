import { shopMediaInputSchema } from "@akinaza/db";
import { describe, expect, it } from "vitest";

import type { GalleryLine } from "@/lib/storefront-form";

import { addPhoto, adoptCover, GALLERY_MAX, mediaPayload } from "./proposed-media";

/** A still the setup page reads back from the database: its loop fields are null, as the page's `line()` gives them. */
const still = (n: number): GalleryLine => ({ url: `https://cdn.test/own-${n}.jpg`, altFr: `Photo ${n}`, altEn: `Picture ${n}`, webmUrl: null, mp4Url: null, wide: false });
const cover = { src: "https://cdn.test/pets-cover-1.webp", altFr: "Un parc", altEn: "A park", webm: "https://cdn.test/l.webm", mp4: "https://cdn.test/l.mp4" };
const photo = (n: number) => ({ src: `https://cdn.test/pets-gallery-${n}.webp`, altFr: `Proposée ${n}`, altEn: `Proposed ${n}` });

describe("what « Images proposées » sends to the media route (#267)", () => {
  it("a retained still carries no null loop field: the route takes the body as it is", () => {
    const state = adoptCover({ cover: null, gallery: [still(1), still(2)] }, cover);
    const body = mediaPayload(state);
    expect(body.gallery[0]).not.toHaveProperty("webmUrl");
    expect(body.gallery[0]).not.toHaveProperty("mp4Url");
    expect(shopMediaInputSchema.safeParse(body).success).toBe(true);
    expect(shopMediaInputSchema.safeParse({ cover: null, gallery: [still(1)] }).success, "the raw line, with its nulls, is what the route refused").toBe(false);
  });

  it("adopting the proposed cover keeps the photos, and carries the loop", () => {
    const state = adoptCover({ cover: still(9), gallery: [still(1)] }, cover);
    expect(state.cover).toMatchObject({ url: cover.src, webmUrl: cover.webm, mp4Url: cover.mp4, altFr: "Un parc", altEn: "A park", wide: false });
    expect(state.gallery.map((g) => g.url)).toEqual([still(1).url]);
    expect(mediaPayload(state).cover).toMatchObject({ webmUrl: cover.webm, mp4Url: cover.mp4 });
  });

  it("two photos added one after the other are both there: each adoption starts from the state the last one left", () => {
    const first = addPhoto({ cover: null, gallery: [] }, photo(1));
    const second = addPhoto(first, photo(2));
    expect(second.gallery.map((g) => g.url)).toEqual([photo(1).src, photo(2).src]);
    expect(second.cover).toBeNull();
    expect(addPhoto(adoptCover(second, cover), photo(3)).cover?.url).toBe(cover.src);
  });

  it("a photo already there is not added twice, and the gallery never passes the route's bound", () => {
    const once = addPhoto({ cover: null, gallery: [] }, photo(1));
    expect(addPhoto(once, photo(1))).toBe(once);
    const full = { cover: null, gallery: Array.from({ length: GALLERY_MAX }, (_, i) => still(i)) };
    expect(addPhoto(full, photo(1)).gallery).toHaveLength(GALLERY_MAX);
    expect(shopMediaInputSchema.safeParse(mediaPayload(addPhoto(full, photo(1)))).success).toBe(true);
  });
});
