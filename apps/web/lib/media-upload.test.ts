import { STORAGE_CODE, StorageError } from "@krizaka/storage";
import { STORAGE_DEFAULTS, type StorageSettings } from "@krizaka/storage/settings";
import { describe, expect, it } from "vitest";

import { deploymentMedia, keyOfAddress, type MediaStorage, mediaStorage } from "./media-storage";
import { detectImage, MAX_UPLOAD_BYTES, mediaPrefix, storeImage } from "./media-upload";

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...Array(32).fill(1)]);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(32).fill(2)]);
const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, ...Array(32).fill(3)]);
const gif = new TextEncoder().encode("GIF89a....");
const KEY = "test-access-value";
const ENV = { MEDIA_STORAGE_API_KEY: KEY, MEDIA_STORAGE_ZONE: "zone-x", MEDIA_STORAGE_ENDPOINT: "storage.example", MEDIA_CDN_HOSTNAME: "cdn.example" };
const ADMIN: StorageSettings = { ...STORAGE_DEFAULTS, endpoint: "", region: "", bucket: "", zone: "", prefix: "", pullHostname: "", publicBaseUrl: "" };
const SHOP = "0b6c1f2e-1111-4222-8333-444455556666";

/** A fetch that records what it was asked and answers `status` (with `body` for a read). */
const recorder = (status = 201, body: Uint8Array = new Uint8Array()) => {
  const calls: { url: string; method: string; headers: Record<string, string> }[] = [];
  const impl = async (url: string, init: { method: string; headers: Record<string, string> }) => {
    calls.push({ url, method: init.method, headers: init.headers });
    return new Response(init.method === "GET" ? (body as unknown as BodyInit) : null, { status, headers: { "content-type": "image/jpeg" } });
  };
  return { calls, impl };
};

const open = async (fake = recorder(), options: { maxBytes?: number; admin?: Partial<StorageSettings> } = {}): Promise<{ media: MediaStorage; calls: ReturnType<typeof recorder>["calls"] }> => {
  const media = await mediaStorage({ source: ENV, admin: { ...ADMIN, ...options.admin }, fetchImpl: fake.impl, maxBytes: options.maxBytes });
  return { media: media!, calls: fake.calls };
};

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

  it("the storage refuses a type that is not allowed and a size over the limit, with the package's codes", async () => {
    const { media } = await open();
    await expect(storeImage(media, SHOP, new TextEncoder().encode("<svg/>"))).rejects.toThrow("not an image");
    const bad = await media.storage.upload({ prefix: "user/akinaza/shops/", name: `${SHOP}/gallery/photo.gif`, bytes: gif, allow: ["image/jpeg"] }).catch((e: unknown) => e);
    expect((bad as StorageError).code).toBe(STORAGE_CODE.badType);
    const small = (await open(recorder(), { maxBytes: 16 })).media;
    const big = await storeImage(small, SHOP, jpeg).catch((e: unknown) => e);
    expect((big as StorageError).code).toBe(STORAGE_CODE.tooBig);
  });
});

describe("where it goes", () => {
  it("is a content-hashed key under the shop, so an address never changes content", async () => {
    const { media, calls } = await open();
    const url = await storeImage(media, SHOP, jpeg, "brand");
    expect(url).toMatch(new RegExp(`^https://cdn\\.example/user/akinaza/shops/${SHOP}/brand/photo\\.[0-9a-f]{10}\\.jpg$`));
    expect(await storeImage(media, SHOP, jpeg, "brand")).toBe(url);
    expect(calls[0]!.url).toBe(url.replace("https://cdn.example/", "https://storage.example/zone-x/"));
  });

  it("maps each media purpose to its own directory", async () => {
    const { media } = await open();
    for (const purpose of ["brand", "wall", "reels", "cards", "announcements", "gallery"] as const) {
      expect(mediaPrefix(SHOP, purpose)).toBe(`user/akinaza/shops/${SHOP}/${purpose}/`);
      expect(await storeImage(media, SHOP, jpeg, purpose)).toMatch(new RegExp(`^https://cdn\\.example/user/akinaza/shops/${SHOP}/${purpose}/photo\\.[0-9a-f]{10}\\.jpg$`));
    }
  });

  it("is configured by environment and is off (fails closed) without it", async () => {
    expect(deploymentMedia({})).toEqual({ environment: "dev", provider: "none" });
    expect(deploymentMedia({ MEDIA_STORAGE_API_KEY: "k", MEDIA_STORAGE_ZONE: "z", MEDIA_CDN_HOSTNAME: "cdn.example" })).toMatchObject({ provider: "http", http: { endpoint: "storage.bunnycdn.com", zone: "z", pullHostname: "cdn.example" } });
    expect(await mediaStorage({ source: {}, admin: ADMIN })).toBeNull();
  });

  it("PUTs the bytes to the storage zone with the access key as a header, and answers the CDN address, never the key", async () => {
    const { media, calls } = await open();
    const url = await storeImage(media, SHOP, jpeg, "brand");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: "PUT", headers: { AccessKey: KEY, "content-type": "image/jpeg" } });
    expect(url).not.toContain(KEY);
  });

  it("follows the administrator's choice over the environment's (another zone)", async () => {
    const { media, calls } = await open(recorder(), { admin: { provider: "http", zone: "chosen-zone" } });
    await storeImage(media, SHOP, jpeg);
    expect(calls[0]!.url).toMatch(/^https:\/\/storage\.example\/chosen-zone\/user\/akinaza\/shops\//);
  });

  it("fails without leaking the access key when the storage refuses", async () => {
    const { media } = await open(recorder(401));
    const error = await storeImage(media, SHOP, jpeg).catch((e: Error) => e);
    expect((error as StorageError).code).toBe(STORAGE_CODE.provider);
    expect((error as Error).message).not.toContain(KEY);
  });
});

describe("the files already published stay readable (akinaza#414)", () => {
  const legacyKey = `user/akinaza/shops/${SHOP}/gallery/0123456789abcdef.jpg`;
  const legacyUrl = `https://cdn.example/${legacyKey}`;

  it("keeps the key, the zone address and the public address of a file stored before the package", async () => {
    const { media, calls } = await open(recorder(200, jpeg));
    expect(media.keyOf(legacyUrl)).toBe(legacyKey);
    expect(await media.storage.urlFor(legacyKey)).toBe(legacyUrl);
    const read = await media.storage.get(legacyKey);
    expect(read?.bytes).toEqual(jpeg);
    expect(calls[0]).toMatchObject({ method: "GET", url: `https://storage.example/zone-x/${legacyKey}`, headers: { AccessKey: KEY } });
  });

  it("deleting a legacy address reaches the same file; a file already gone counts as removed", async () => {
    const { media, calls } = await open(recorder(404));
    const { deleteStored } = await import("./media-upload");
    expect(await deleteStored(media, legacyUrl)).toBe(true);
    expect(calls).toEqual([{ url: `https://storage.example/zone-x/${legacyKey}`, method: "DELETE", headers: { AccessKey: KEY } }]);
  });

  it("names only this CDN's files under the media root", () => {
    for (const url of ["https://elsewhere.example/user/akinaza/shops/x.jpg", "https://cdn.example/site/home/backdrop.jpg", "https://cdn.example/user/akinaza/shops/../../site/x"]) expect(keyOfAddress("cdn.example", url)).toBeNull();
  });
});
