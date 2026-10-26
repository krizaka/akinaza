import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { migrate, query } from "@/lib/db";
import { resetRateLimits } from "@/lib/rate-limit";

import { apiCall, closeSuite, type Handler, openBookableShop, testAccount } from "./test-api";
import { GET as getAnnouncements, POST as addFlyer } from "./walker/announcements/route";
import { GET as getReels, POST as linkReel } from "./walker/reels/route";
import { POST as uploadReel } from "./walker/reels/upload/route";
import { GET as getReviews } from "./walker/reviews/route";
import { PATCH as patchReview } from "./walker/reviews/[id]/route";
import { PUT as putLinks } from "./walker/social-links/route";
import { GET as getWall, PUT as putWall } from "./walker/wall/route";

/** The shop as a place over HTTP (B45): who may write, the bounds of the wall, the reel's links and bytes, the reviews. Real PostgreSQL (DATABASE_IT=1). */
const enabled = process.env.DATABASE_IT === "1" && !!process.env.DATABASE_URL;

describe.runIf(enabled)("the shop as a place over HTTP", () => {
  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const people = {} as Record<"owner" | "manager" | "staff" | "other", { id: string; token: string }>;
  let shopId: string;
  const call = (handler: unknown, method: string, token: string | undefined, opts: { json?: unknown; form?: FormData; params?: Record<string, string> } = {}) =>
    apiCall(handler as Handler, method, "/api/walker/x", { token, ...opts });
  const photo = (over: Record<string, unknown> = {}) => ({ kind: "polaroid", x: 10, y: 20, rotation: 0, z: 1, imageUrl: "https://cdn.example/a.webp", altFr: "Photo", altEn: "Photo", captionFr: "", captionEn: "", ...over });

  beforeAll(async () => {
    vi.stubEnv("REALTIME_BUS", "memory");
    await migrate();
    for (const label of ["owner", "manager", "staff", "other"] as const) people[label] = await testAccount(label, stamp);
    shopId = (await openBookableShop(people.owner.token, "Atelier C", `c-${stamp}`)).shopId;
    await openBookableShop(people.other.token, "Atelier D", `d-${stamp}`);
    for (const label of ["manager", "staff"] as const) await query("INSERT INTO memberships (scope_id, account_id, role, created_at) VALUES ($1, $2, $3, now())", [shopId, people[label].id, label]);
  });
  beforeEach(() => resetRateLimits());
  afterAll(() => closeSuite(stamp));

  it("lets the owner and the manager write the wall, and the staff only read it", async () => {
    expect((await call(putWall, "PUT", people.owner.token, { json: { texture: "brick", items: [photo()] } })).status).toBe(200);
    expect((await call(putWall, "PUT", people.manager.token, { json: { texture: "ridge", items: [photo()] } })).status).toBe(200);
    expect((await call(putWall, "PUT", people.staff.token, { json: { texture: "brick", items: [] } })).status).toBe(403);
    const read = await call(getWall, "GET", people.staff.token);
    expect(read.status).toBe(200);
    expect(read.body.texture).toBe("ridge");
    expect(read.body.limits.wallItems).toBe(24);
  });

  it.each([
    ["x over 100", { x: 100.1 }],
    ["y under 0", { y: -0.1 }],
    ["a tilt over 8 degrees", { rotation: 8.1 }],
    ["a caption over 40 characters", { captionFr: "x".repeat(41) }],
    ["a photo not on https", { imageUrl: "http://cdn.example/a.webp" }],
  ])("answers 400 to %s and keeps the wall", async (_name, over) => {
    const before = (await call(getWall, "GET", people.owner.token)).body;
    expect((await call(putWall, "PUT", people.owner.token, { json: { texture: "zellige", items: [photo(over)] } })).status).toBe(400);
    expect((await call(getWall, "GET", people.owner.token)).body.texture).toBe(before.texture);
  });

  it("answers 400 to more items than limits.wallItems (24 by default)", async () => {
    const many = Array.from({ length: 25 }, (_, i) => photo({ z: i }));
    expect((await call(putWall, "PUT", people.owner.token, { json: { texture: "brick", items: many } })).status).toBe(400);
  });

  it("links a reel on an allowed host only", async () => {
    expect((await call(linkReel, "POST", people.owner.token, { json: { url: "https://www.youtube.com/shorts/abcDEF12345" } })).status).toBe(201);
    for (const url of ["https://evil.example/x", "http://www.tiktok.com/@a/video/12345678", "https://www.tiktok.com.evil.example/@a/video/12345678"]) {
      expect((await call(linkReel, "POST", people.owner.token, { json: { url } })).status, url).toBe(400);
    }
    expect((await call(getReels, "GET", people.staff.token)).body.reels[0].platform).toBe("youtube-shorts");
  });

  it("refuses a reel upload that is not a video, by its bytes, whatever its name says", async () => {
    const form = new FormData();
    form.set("video", new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])], "reel.mp4", { type: "video/mp4" }));
    const res = await call(uploadReel, "POST", people.owner.token, { form });
    // 503 where the media storage is not configured (a dev machine): the fail-closed answer comes before the bytes are read.
    expect([400, 503]).toContain(res.status);
    if (res.status === 400) expect(res.body.code).toBe("UPLOAD_NOT_VIDEO");
  });

  it("saves the profile links on their own hosts", async () => {
    expect((await call(putLinks, "PUT", people.owner.token, { json: { instagram: "https://www.instagram.com/atelier" } })).status).toBe(200);
    expect((await call(putLinks, "PUT", people.owner.token, { json: { instagram: "https://www.tiktok.com/@atelier" } })).status).toBe(400);
  });

  it("pins and lists flyers; the staff reads, cannot write", async () => {
    expect((await call(addFlyer, "POST", people.manager.token, { json: { textFr: "Portes ouvertes samedi" } })).status).toBe(201);
    expect((await call(addFlyer, "POST", people.staff.token, { json: { textFr: "Non" } })).status).toBe(403);
    expect((await call(addFlyer, "POST", people.owner.token, { json: { textFr: "x".repeat(501) } })).status).toBe(400);
    expect((await call(getAnnouncements, "GET", people.staff.token)).body.announcements).toHaveLength(1);
  });

  it("lets the owner answer and hide a review, and the score follows the administrator's rules", async () => {
    const [row] = await query<{ id: string }>("INSERT INTO shop_reviews (shop_id, first_name, last_initial, rating, body, verified) VALUES ($1, 'Camille', 'T', 5, 'Très bien', true) RETURNING id", [shopId]);
    const id = row!.id;
    expect((await call(patchReview, "PATCH", people.staff.token, { json: { reply: "Merci" }, params: { id } })).status).toBe(403);
    expect((await call(patchReview, "PATCH", people.manager.token, { json: { reply: "Merci !" }, params: { id } })).status).toBe(200);
    const list = await call(getReviews, "GET", people.owner.token);
    expect(list.body.reviews[0]).toMatchObject({ reply: "Merci !", firstName: "Camille" });
    expect(JSON.stringify(list.body)).not.toContain("clientId");
    expect(list.body.score.shown).toBe(false);
    expect((await call(patchReview, "PATCH", people.owner.token, { json: { state: "hidden_by_owner" }, params: { id } })).status).toBe(200);
    expect((await call(getReviews, "GET", people.owner.token)).body.score.count).toBe(0);
  });

  it("answers 404 to another shop's member on every new route", async () => {
    for (const [handler, method] of [[getWall, "GET"], [getReels, "GET"], [getAnnouncements, "GET"], [getReviews, "GET"]] as const) {
      const res = await apiCall(handler as Handler, method, `/api/walker/x?shopId=${shopId}`, { token: people.other.token });
      expect(res.status).toBe(404);
    }
  });
});
