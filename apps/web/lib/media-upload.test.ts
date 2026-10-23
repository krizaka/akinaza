import { describe, expect, it } from "vitest";

import { detectImage, MAX_UPLOAD_BYTES, mediaPrefix, mediaSettings, storeImage, uploadKey } from "./media-upload";

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...Array(32).fill(1)]);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(32).fill(2)]);
const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, ...Array(32).fill(3)]);
const KEY = "test-access-value";
const SETTINGS = { apiKey: KEY, zone: "zone-x", endpoint: "storage.example", cdn: "cdn.example" };
const SHOP = "0b6c1f2e-1111-4222-8333-444455556666";

describe("what an owner may upload", () => {
  it("accepts a JPEG, a PNG or a WebP by its bytes, never by its name or declared type", () => {
    expect(detectImage(jpeg)).toEqual({ ext: "jpg", mime: "image/jpeg" });
    expect(detectImage(png)).toEqual({ ext: "png", mime: "image/png" });
    expect(detectImage(webp)).toEqual({ ext: "webp", mime: "image/webp" });
  });

  it("refuses anything else: an SVG, HTML, a GIF, an empty file", () => {
    for (const text of ["<svg xmlns='http://www.w3.org/2000/svg'/>", "<html><script>1</script>", "GIF89a....", ""]) expect(detectImage(new TextEncoder().encode(text))).toBeNull();
  });

  it("keeps the upload small (the phone redraws it first)", () => {
    expect(MAX_UPLOAD_BYTES).toBeLessThanOrEqual(3 * 1024 * 1024);
  });
});

describe("where it goes", () => {
  it("is a content-hashed key under the shop, so an address never changes content", () => {
    const key = uploadKey(SHOP, jpeg, "jpg");
    expect(key).toMatch(new RegExp(`^user/akinaza/shops/${SHOP}/gallery/[0-9a-f]{16}\\.jpg$`));
    expect(uploadKey(SHOP, jpeg, "jpg")).toBe(key);
  });

  it("maps each media purpose to its own directory", () => {
    for (const purpose of ["brand", "wall", "reels", "cards", "announcements", "gallery"] as const) {
      expect(mediaPrefix(SHOP, purpose)).toBe(`user/akinaza/shops/${SHOP}/${purpose}/`);
      expect(uploadKey(SHOP, jpeg, "jpg", purpose)).toMatch(new RegExp(`^user/akinaza/shops/${SHOP}/${purpose}/[0-9a-f]{16}\\.jpg$`));
    }
  });

  it("is configured by environment and is off (fails closed) without it", () => {
    expect(mediaSettings({})).toBeNull();
    expect(mediaSettings({ MEDIA_STORAGE_API_KEY: "k", MEDIA_STORAGE_ZONE: "z", MEDIA_CDN_HOSTNAME: "cdn.example" })).toEqual({ apiKey: "k", zone: "z", endpoint: "storage.bunnycdn.com", cdn: "cdn.example" });
  });

  it("PUTs the bytes to the storage zone and answers the CDN address, never the access value", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response("", { status: 201 });
    }) as unknown as typeof fetch;
    const url = await storeImage(SETTINGS, SHOP, jpeg, fake, "brand");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toMatch(new RegExp(`^https://storage\\.example/zone-x/user/akinaza/shops/${SHOP}/brand/[0-9a-f]{16}\\.jpg$`));
    expect((calls[0]!.init.headers as Record<string, string>).AccessKey).toBe(KEY);
    expect(calls[0]!.init.method).toBe("PUT");
    expect(url).toMatch(/^https:\/\/cdn\.example\/user\/akinaza\/shops\//);
    expect(url).not.toContain(KEY);
  });

  it("fails without leaking the access value when the storage refuses, and refuses a non-image", async () => {
    const fake = (async () => new Response(`denied ${KEY}`, { status: 401 })) as unknown as typeof fetch;
    const error = await storeImage(SETTINGS, SHOP, jpeg, fake).catch((e: Error) => e);
    expect((error as Error).message).toBe("media storage refused (401)");
    await expect(storeImage(SETTINGS, SHOP, new TextEncoder().encode("<svg/>"), fake)).rejects.toThrow("not an image");
  });
});
