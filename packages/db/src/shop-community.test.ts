import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { eraseClient } from "./shop-ops";
import { addAnnouncement, addExternalReel, addReview, addUploadedReel, announcementsOf, communityOf, reelsOf, removeAnnouncement, removeReel, replyToReview, reviewsOf, saveSocialLinks, saveWall, setReviewState, socialLinksOf, wallOf } from "./shop-community";
import { freshDatabase, refusal } from "./test/db";
import { walkerShop } from "./test/fixtures";

let t: Awaited<ReturnType<typeof freshDatabase>>;
beforeAll(async () => {
  t = await freshDatabase();
});
afterAll(async () => t.drop());

const photo = (z: number, over: Record<string, unknown> = {}) => ({ kind: "polaroid", x: 10 + z, y: 20, rotation: 1, z, imageUrl: `https://cdn.example/p${z}.webp`, altFr: "Une photo", altEn: "A photo", captionFr: "Légende", captionEn: "Caption", ...over });

describe("the wall (#310)", () => {
  it("is empty and plaster before the owner pins anything", async () => {
    const s = await walkerShop(t.db, "wall-empty");
    expect(await wallOf(t.db, s.shopId)).toEqual({ texture: "plaster", items: [] });
  });

  it("saves the texture and the items, read back in stacking order", async () => {
    const s = await walkerShop(t.db, "wall-save");
    await saveWall(t.db, s.shopId, { texture: "brick", items: [photo(2), photo(1), { kind: "note", x: 50, y: 50, rotation: -2, z: 3, textFr: "Merci", textEn: "Thanks", signature: "Léa" }, { kind: "sign", x: 80, y: 10, z: 4 }] }, 24);
    const wall = await wallOf(t.db, s.shopId);
    expect(wall.texture).toBe("brick");
    expect(wall.items.map((i) => i.z)).toEqual([1, 2, 3, 4]);
    expect(wall.items.map((i) => i.kind)).toEqual(["polaroid", "polaroid", "note", "sign"]);
  });

  it("replaces the whole wall on a save, in one step", async () => {
    const s = await walkerShop(t.db, "wall-replace");
    await saveWall(t.db, s.shopId, { texture: "ridge", items: [photo(1), photo(2)] }, 24);
    await saveWall(t.db, s.shopId, { texture: "zellige", items: [photo(5)] }, 24);
    const wall = await wallOf(t.db, s.shopId);
    expect(wall).toMatchObject({ texture: "zellige" });
    expect(wall.items).toHaveLength(1);
  });

  it.each([
    ["x over 100", photo(1, { x: 101 })],
    ["y under 0", photo(1, { y: -1 })],
    ["a tilt of 9 degrees", photo(1, { rotation: 9 })],
    ["a caption of 41 characters", photo(1, { captionFr: "x".repeat(41) })],
    ["a photo that is not https", photo(1, { imageUrl: "http://cdn.example/a.webp" })],
  ])("refuses %s and keeps the wall as it was", async (_name, item) => {
    const s = await walkerShop(t.db, `wall-bad-${_name.replace(/\W/g, "")}`);
    await saveWall(t.db, s.shopId, { texture: "brick", items: [photo(1)] }, 24);
    await expect(saveWall(t.db, s.shopId, { texture: "ridge", items: [item] }, 24)).rejects.toThrow();
    expect((await wallOf(t.db, s.shopId)).texture).toBe("brick");
  });

  it("refuses more items than the administrator's limit (a wall of 24 by default)", async () => {
    const s = await walkerShop(t.db, "wall-limit");
    const items = Array.from({ length: 4 }, (_, i) => photo(i));
    expect(await refusal(saveWall(t.db, s.shopId, { texture: "brick", items }, 3))).toBeTruthy();
    await saveWall(t.db, s.shopId, { texture: "brick", items }, 4);
  });

  it("never reads or changes another shop's wall", async () => {
    const a = await walkerShop(t.db, "wall-a");
    const b = await walkerShop(t.db, "wall-b");
    await saveWall(t.db, a.shopId, { texture: "brick", items: [photo(1)] }, 24);
    expect((await wallOf(t.db, b.shopId)).items).toEqual([]);
  });
});

describe("the reels (#312)", () => {
  it("keeps an uploaded reel as CDN addresses and shows the latest", async () => {
    const s = await walkerShop(t.db, "reel-up");
    await addUploadedReel(t.db, s.shopId, { mp4Url: "https://cdn.example/a.mp4", webmUrl: "https://cdn.example/a.webm", posterUrl: "https://cdn.example/a.webp", seconds: 7.8, titleFr: "Ma semaine", titleEn: "My week" });
    await addExternalReel(t.db, s.shopId, "https://www.youtube.com/shorts/abcDEF12345", { titleFr: "", titleEn: "" });
    const reels = await reelsOf(t.db, s.shopId);
    expect(reels).toHaveLength(2);
    expect(reels[0]!.kind).toBe("external");
    expect((await communityOf(t.db, s.shopId)).reel?.kind).toBe("external");
  });

  it("refuses a link to any other host", async () => {
    const s = await walkerShop(t.db, "reel-host");
    await expect(addExternalReel(t.db, s.shopId, "https://evil.example/shorts/abcDEF12345", { titleFr: "", titleEn: "" })).rejects.toMatchObject({ code: "AK_REEL_LINK" });
    await expect(addExternalReel(t.db, s.shopId, "http://www.tiktok.com/@a/video/12345678", { titleFr: "", titleEn: "" })).rejects.toMatchObject({ code: "AK_REEL_LINK" });
  });

  it("removes a reel of this shop only", async () => {
    const a = await walkerShop(t.db, "reel-rm-a");
    const b = await walkerShop(t.db, "reel-rm-b");
    const id = await addExternalReel(t.db, a.shopId, "https://www.instagram.com/reel/Cabc123xyz/", { titleFr: "", titleEn: "" });
    expect(await removeReel(t.db, b.shopId, id)).toBe(false);
    expect(await reelsOf(t.db, a.shopId)).toHaveLength(1);
    expect(await removeReel(t.db, a.shopId, id)).toBe(true);
  });

  it("holds twelve reels at most", async () => {
    const s = await walkerShop(t.db, "reel-max");
    for (let i = 0; i < 12; i++) await addUploadedReel(t.db, s.shopId, { mp4Url: `https://cdn.example/${i}.mp4`, webmUrl: null, posterUrl: null, seconds: 5, titleFr: "", titleEn: "" });
    await expect(addUploadedReel(t.db, s.shopId, { mp4Url: "https://cdn.example/13.mp4", webmUrl: null, posterUrl: null, seconds: 5, titleFr: "", titleEn: "" })).rejects.toMatchObject({ code: "AK_REEL_LIMIT" });
  });
});

describe("the profile links (#312)", () => {
  it("saves one link per platform on its own host, and removes one with null", async () => {
    const s = await walkerShop(t.db, "social");
    await saveSocialLinks(t.db, s.shopId, { instagram: "https://www.instagram.com/cedre", tiktok: "https://www.tiktok.com/@cedre" });
    expect(await socialLinksOf(t.db, s.shopId)).toEqual({ instagram: "https://www.instagram.com/cedre", tiktok: "https://www.tiktok.com/@cedre" });
    await saveSocialLinks(t.db, s.shopId, { tiktok: null });
    expect(Object.keys(await socialLinksOf(t.db, s.shopId))).toEqual(["instagram"]);
  });
  it("refuses another platform's address", async () => {
    const s = await walkerShop(t.db, "social-bad");
    await expect(saveSocialLinks(t.db, s.shopId, { instagram: "https://www.tiktok.com/@x" })).rejects.toMatchObject({ code: "AK_SOCIAL_LINK" });
  });
});

describe("the bulletin board (#314)", () => {
  it("pins a flyer, lists it, takes it down", async () => {
    const s = await walkerShop(t.db, "board");
    const id = await addAnnouncement(t.db, s.shopId, { textFr: "Portes ouvertes samedi", textEn: "", photoUrl: null, photoAlt: "", endsOn: "2026-12-31" });
    expect((await announcementsOf(t.db, s.shopId)).map((a) => a.id)).toEqual([id]);
    expect(await removeAnnouncement(t.db, s.shopId, id)).toBe(true);
    expect(await announcementsOf(t.db, s.shopId)).toEqual([]);
  });
  it("refuses an empty flyer and a flyer of 501 characters", async () => {
    const s = await walkerShop(t.db, "board-bad");
    await expect(addAnnouncement(t.db, s.shopId, { textFr: "", textEn: "", photoUrl: null, photoAlt: "", endsOn: null })).rejects.toThrow();
    await expect(addAnnouncement(t.db, s.shopId, { textFr: "x".repeat(501), textEn: "", photoUrl: null, photoAlt: "", endsOn: null })).rejects.toThrow();
  });
  it("takes down another shop's flyer? No: it answers false", async () => {
    const a = await walkerShop(t.db, "board-a");
    const b = await walkerShop(t.db, "board-b");
    const id = await addAnnouncement(t.db, a.shopId, { textFr: "Bonjour", textEn: "", photoUrl: null, photoAlt: "", endsOn: null });
    expect(await removeAnnouncement(t.db, b.shopId, id)).toBe(false);
  });
});

describe("the reviews (#313)", () => {
  const review = (over: Record<string, unknown> = {}) => ({ firstName: "Camille", lastInitial: "T", rating: 5, body: "Très bien", serviceName: "Coupe", verified: true, ...over });

  it("lists only what a visitor may read: a first name and an initial, never the client", async () => {
    const s = await walkerShop(t.db, "rev-public");
    await addReview(t.db, s.shopId, review({ clientId: s.camille.clientId }));
    await addReview(t.db, s.shopId, review({ firstName: "Pending", state: "pending" }));
    await addReview(t.db, s.shopId, review({ firstName: "Hidden", state: "hidden_by_owner" }));
    const publicList = (await communityOf(t.db, s.shopId)).reviews;
    expect(publicList.map((r) => r.firstName)).toEqual(["Camille"]);
    expect(JSON.stringify(publicList)).not.toContain(s.camille.clientId);
    expect((await reviewsOf(t.db, s.shopId)).length).toBe(3);
  });

  it("has one review per client and refuses a rating outside 1 to 5", async () => {
    const s = await walkerShop(t.db, "rev-one");
    await addReview(t.db, s.shopId, review({ clientId: s.camille.clientId }));
    await expect(addReview(t.db, s.shopId, review({ clientId: s.camille.clientId }))).rejects.toThrow();
    await expect(addReview(t.db, s.shopId, review({ rating: 6 }))).rejects.toThrow();
    await expect(addReview(t.db, s.shopId, review({ rating: 0 }))).rejects.toThrow();
  });

  it("lets the owner reply and hide, of this shop's reviews only", async () => {
    const a = await walkerShop(t.db, "rev-owner-a");
    const b = await walkerShop(t.db, "rev-owner-b");
    const id = await addReview(t.db, a.shopId, review());
    expect(await replyToReview(t.db, b.shopId, id, "Merci")).toBe(false);
    expect(await setReviewState(t.db, b.shopId, id, "hidden_by_owner")).toBe(false);
    expect(await replyToReview(t.db, a.shopId, id, "Merci !")).toBe(true);
    expect(await setReviewState(t.db, a.shopId, id, "hidden_by_owner")).toBe(true);
    expect((await communityOf(t.db, a.shopId)).reviews).toEqual([]);
    expect((await reviewsOf(t.db, a.shopId))[0]).toMatchObject({ reply: "Merci !", state: "hidden_by_owner" });
  });

  it("an owner cannot publish what the administrator removed", async () => {
    const s = await walkerShop(t.db, "rev-removed");
    const id = await addReview(t.db, s.shopId, review({ state: "removed_by_admin" }));
    await expect(setReviewState(t.db, s.shopId, id, "published")).rejects.toMatchObject({ code: "AK_REVIEW_REMOVED" });
  });

  it("is blanked with the client's erasure (Loi 25), the rating kept for the score", async () => {
    const s = await walkerShop(t.db, "rev-erase");
    await addReview(t.db, s.shopId, review({ clientId: s.camille.clientId, body: "Je m'appelle Camille Tremblay" }));
    await eraseClient(t.db, s.camille.clientId, "v1");
    const [row] = await reviewsOf(t.db, s.shopId);
    expect(row).toMatchObject({ firstName: "—", lastInitial: "", body: "", rating: 5 });
  });
});
