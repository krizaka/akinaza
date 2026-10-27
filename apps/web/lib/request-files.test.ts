import { describe, expect, it } from "vitest";

import { type MediaStorage, mediaStorage } from "./media-storage";
import { deleteStored, detectRequestFile, MAX_REQUEST_FILE_BYTES, storeRequestFile } from "./media-upload";

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...Array(32).fill(1)]);
const pdf = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");
const ENV = { MEDIA_STORAGE_API_KEY: "test-access-value", MEDIA_STORAGE_ZONE: "zone-x", MEDIA_STORAGE_ENDPOINT: "storage.example", MEDIA_CDN_HOSTNAME: "cdn.example" };
const ADMIN = { provider: "local", maxMegabytes: 25, signedUrlSeconds: 300, endpoint: "", region: "", bucket: "", zone: "", prefix: "", pullHostname: "", publicBaseUrl: "" } as const;
const SHOP = "0b6c1f2e-1111-4222-8333-444455556666";
const REQUEST = "7a1d2c3b-aaaa-4bbb-8ccc-ddddeeeeffff";

/** A storage over a fetch that records what it was asked and answers `status`. */
const open = async (status = 201) => {
  const calls: { url: string; method: string; headers: Record<string, string> }[] = [];
  const fetchImpl = async (url: string, init: { method: string; headers: Record<string, string> }) => {
    calls.push({ url, method: init.method, headers: init.headers });
    return new Response(null, { status });
  };
  const media = (await mediaStorage({ source: ENV, admin: ADMIN, fetchImpl, maxBytes: MAX_REQUEST_FILE_BYTES })) as MediaStorage;
  return { media, calls };
};

describe("a client's request files (akinaza#210)", () => {
  it("a photo or a PDF, by its bytes; anything else is refused", () => {
    expect(detectRequestFile(jpeg)).toMatchObject({ kind: "image", ext: "jpg" });
    expect(detectRequestFile(pdf)).toEqual({ ext: "pdf", mime: "application/pdf", kind: "pdf" });
    for (const text of ["<svg/>", "<html>", "PK\u0003\u0004 a zip", ""]) expect(detectRequestFile(new TextEncoder().encode(text))).toBeNull();
    expect(MAX_REQUEST_FILE_BYTES).toBeLessThanOrEqual(5 * 1024 * 1024);
  });

  it("is stored content-hashed under the shop's requests/<id>/, and answered as its CDN address", async () => {
    const { media, calls } = await open();
    const stored = await storeRequestFile(media, SHOP, REQUEST, pdf);
    expect(stored.kind).toBe("pdf");
    expect(stored.url).toMatch(new RegExp(`^https://cdn\\.example/user/akinaza/shops/${SHOP}/requests/${REQUEST}/file\\.[0-9a-f]{10}\\.pdf$`));
    expect(calls[0]).toMatchObject({ url: stored.url.replace("https://cdn.example/", "https://storage.example/zone-x/"), method: "PUT" });
  });

  it("deleting reaches only this zone's own files, and a file already gone counts as removed", async () => {
    const { media, calls } = await open(404);
    const key = `user/akinaza/shops/${SHOP}/requests/${REQUEST}/0123456789abcdef.jpg`;
    expect(await deleteStored(media, `https://cdn.example/${key}`)).toBe(true);
    expect(calls).toEqual([{ url: `https://storage.example/zone-x/${key}`, method: "DELETE", headers: { AccessKey: "test-access-value" } }]);
    for (const url of ["https://elsewhere.example/user/akinaza/x.jpg", "https://cdn.example/site/home/backdrop.jpg", "https://cdn.example/user/akinaza/../../site/x"]) expect(await deleteStored(media, url)).toBe(false);
    expect(calls).toHaveLength(1);
  });
});
