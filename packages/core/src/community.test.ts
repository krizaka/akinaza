import { describe, expect, it } from "vitest";

import { ANNOUNCEMENT_LIMITS, currentAnnouncements, detectVideo, externalReel, reviewScore, socialLink, WALL_LIMITS, wallItemSchema, wallSchema } from "./community";

const place = { x: 10, y: 20, rotation: 2, z: 1 };
const polaroid = { kind: "polaroid", ...place, imageUrl: "https://cdn.example/a.webp", altFr: "Un fauteuil", altEn: "A chair", captionFr: "Le fauteuil", captionEn: "The chair", attachment: "tape" } as const;

describe("the wall's items (#310)", () => {
  it("accepts a photo, a card and a sign", () => {
    expect(wallItemSchema.safeParse(polaroid).success).toBe(true);
    expect(wallItemSchema.safeParse({ kind: "note", ...place, textFr: "Merci !", textEn: "", signature: "Maëlle", attachment: "pin" }).success).toBe(true);
    expect(wallItemSchema.safeParse({ kind: "sign", ...place, variant: "enamel" }).success).toBe(true);
  });
  it.each([
    ["x above 100", { ...polaroid, x: 101 }],
    ["x below 0", { ...polaroid, x: -1 }],
    ["y above 100", { ...polaroid, y: 100.5 }],
    ["y below 0", { ...polaroid, y: -0.1 }],
    ["a tilt over 8 degrees", { ...polaroid, rotation: 8.5 }],
    ["a tilt under -8 degrees", { ...polaroid, rotation: -9 }],
    ["a caption of 41 characters", { ...polaroid, captionFr: "x".repeat(WALL_LIMITS.caption + 1) }],
    ["a photo that is not https", { ...polaroid, imageUrl: "http://cdn.example/a.webp" }],
    ["a photo without its alternative text", { ...polaroid, altFr: "", altEn: "" }],
    ["a javascript address", { ...polaroid, imageUrl: "javascript:alert(1)" }],
    ["a card of 141 characters", { kind: "note", ...place, textFr: "x".repeat(WALL_LIMITS.note + 1), textEn: "" }],
    ["a card with no word", { kind: "note", ...place, textFr: "", textEn: "" }],
    ["an unknown kind", { kind: "video", ...place }],
    ["a non-finite position", { ...polaroid, x: Number.NaN }],
  ])("refuses %s", (_name, item) => {
    expect(wallItemSchema.safeParse(item).success).toBe(false);
  });
  it("counts the characters the owner typed, not a trimmed copy", () => {
    expect(wallItemSchema.safeParse({ ...polaroid, captionFr: `${"x".repeat(WALL_LIMITS.caption)} ` }).success).toBe(false);
  });
  it("holds at most the administrator's number of items, and a texture among four", () => {
    const items = Array.from({ length: 3 }, (_, i) => ({ ...polaroid, z: i }));
    expect(wallSchema(2).safeParse({ texture: "brick", items }).success).toBe(false);
    expect(wallSchema(3).safeParse({ texture: "brick", items }).success).toBe(true);
    expect(wallSchema(3).safeParse({ texture: "marble", items }).success).toBe(false);
  });
});

describe("the score (#313)", () => {
  const rows = (ratings: number[], extra: Partial<{ verified: boolean; state: string }> = {}) => ratings.map((rating) => ({ rating, verified: true, state: "published", ...extra }));
  it("is a Bayesian average, one decimal, with the distribution", () => {
    const score = reviewScore(rows([5, 5, 5, 4, 4]), { prior: 4, weight: 5, minCount: 5 });
    expect(score.count).toBe(5);
    expect(score.score).toBe(4.3);
    expect(score.distribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 2, 5: 3 });
    expect(score.shown).toBe(true);
  });
  it("counts only published and verified reviews", () => {
    const score = reviewScore([...rows([5, 5, 5, 5, 5]), ...rows([1], { verified: false }), ...rows([1], { state: "hidden_by_owner" }), ...rows([1], { state: "removed_by_admin" })], { prior: 4, weight: 5, minCount: 5 });
    expect(score.count).toBe(5);
    expect(score.distribution[1]).toBe(0);
  });
  it("shows nothing under the minimum", () => {
    const score = reviewScore(rows([5, 5, 5, 5]), { prior: 4, weight: 5, minCount: 5 });
    expect(score.shown).toBe(false);
  });
  it("pulls a lone five-star review towards the prior", () => {
    expect(reviewScore(rows([5]), { prior: 4, weight: 5, minCount: 1 }).score).toBe(4.2);
    expect(reviewScore([], { prior: 4, weight: 5, minCount: 1 }).score).toBeNull();
  });
});

describe("the bulletin board (#314)", () => {
  const a = (id: string, endsOn: string | null, createdAt: string) => ({ id, endsOn, createdAt: new Date(createdAt) });
  it("keeps the current ones, newest first, at most three", () => {
    const list = [a("old", "2026-10-01", "2026-09-01"), a("a", "2026-11-01", "2026-10-01"), a("b", null, "2026-10-05"), a("c", "2026-10-26", "2026-10-10"), a("d", "2026-12-01", "2026-10-20")];
    expect(currentAnnouncements(list, "2026-10-26").map((x) => x.id)).toEqual(["d", "c", "b"]);
    expect(ANNOUNCEMENT_LIMITS.current).toBe(3);
  });
  it("ends the day after its end date", () => {
    expect(currentAnnouncements([a("x", "2026-10-25", "2026-10-01")], "2026-10-26")).toEqual([]);
  });
});

describe("external reels and profile links (#312)", () => {
  it.each([
    ["https://www.tiktok.com/@cedre/video/7300000000000000000", "tiktok"],
    ["https://www.youtube.com/shorts/abcDEF12345", "youtube-shorts"],
    ["https://youtu.be/abcDEF12345", "youtube-shorts"],
    ["https://www.instagram.com/reel/Cabc123xyz/", "instagram"],
  ])("recognises %s", (url, platform) => {
    expect(externalReel(url)?.platform).toBe(platform);
  });
  it.each([
    "http://www.tiktok.com/@a/video/1",
    "https://evil.example/https://www.tiktok.com/@a/video/1",
    "https://www.tiktok.com.evil.example/@a/video/1",
    "https://user:pass@www.tiktok.com/@a/video/1",
    "https://www.tiktok.com:8443/@a/video/1",
    "https://www.youtube.com/watch?v=abc",
    "javascript:alert(1)",
    "not a url",
  ])("refuses %s", (url) => {
    expect(externalReel(url)).toBeNull();
  });
  it("accepts a profile on its own platform only", () => {
    expect(socialLink("instagram", "https://www.instagram.com/cedre.ciseaux")).toBe("https://www.instagram.com/cedre.ciseaux");
    expect(socialLink("instagram", "https://www.tiktok.com/@x")).toBeNull();
    expect(socialLink("facebook", "https://www.facebook.com/cedre")).not.toBeNull();
    expect(socialLink("tiktok", "http://www.tiktok.com/@x")).toBeNull();
  });
});

describe("a reel upload is checked by its bytes (#312)", () => {
  const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const box = (type: string, ...parts: number[][]) => { const body = parts.flat(); return [...u32(8 + body.length), ...[...type].map((c) => c.charCodeAt(0)), ...body]; };
  const mp4 = (seconds: number) => new Uint8Array([...box("ftyp", [...[..."isom"].map((c) => c.charCodeAt(0)), 0, 0, 2, 0]), ...box("moov", box("mvhd", [0, 0, 0, 0], u32(0), u32(0), u32(1000), u32(seconds * 1000)))]);
  const webm = (seconds: number) => {
    const f32 = new DataView(new ArrayBuffer(4)); f32.setFloat32(0, seconds * 1000);
    const duration = [0x44, 0x89, 0x84, ...new Uint8Array(f32.buffer)];
    const info = [0x15, 0x49, 0xa9, 0x66, 0x80 | (3 + 4 + 3 + 0 + 4), 0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40, ...duration];
    return new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x80, 0x18, 0x53, 0x80, 0x67, 0x01, 0, 0, 0, 0, 0, 0, 0xff, ...info]);
  };
  it("reads the duration of an MP4 and of a WebM", () => {
    expect(detectVideo(mp4(8))).toMatchObject({ ext: "mp4", mime: "video/mp4", seconds: 8 });
    expect(detectVideo(webm(6))).toMatchObject({ ext: "webm", mime: "video/webm" });
    expect(detectVideo(webm(6))?.seconds).toBeCloseTo(6, 1);
  });
  it("refuses an image, a script, an empty file and a video with no readable duration", () => {
    expect(detectVideo(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBeNull();
    expect(detectVideo(new TextEncoder().encode("<html>"))).toBeNull();
    expect(detectVideo(new Uint8Array())).toBeNull();
    expect(detectVideo(new Uint8Array(box("ftyp", [..."isom"].map((c) => c.charCodeAt(0)), [0, 0, 2, 0])))).toBeNull();
  });
});

describe("the neighbourhood feed (#318)", () => {
  it("folds accents, case and punctuation", async () => {
    const { foldArea } = await import("./community");
    expect(foldArea("  Côte-des-Neiges, Montréal ")).toBe("cote des neiges montreal");
  });
  it("matches a locality that contains the asked neighbourhood", async () => {
    const { areaMatches, quartierOf } = await import("./community");
    expect(areaMatches("Saint-Henri, Montréal", "saint henri")).toBe(true);
    expect(areaMatches("Saint-Henri, Montréal", "Villeray")).toBe(false);
    expect(areaMatches(null, "Saint-Henri")).toBe(false);
    expect(areaMatches("Saint-Henri", "")).toBe(true);
    expect(quartierOf("Saint-Henri, Montréal")).toBe("Saint-Henri");
    expect(quartierOf("Villeray")).toBe("Villeray");
  });
});
