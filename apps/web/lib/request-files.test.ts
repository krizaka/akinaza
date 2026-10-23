import { describe, expect, it } from "vitest";

import { deleteStored, detectRequestFile, MAX_REQUEST_FILE_BYTES, requestFileKey, storeRequestFile } from "./media-upload";

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...Array(32).fill(1)]);
const pdf = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");
const SETTINGS = { apiKey: "test-access-value", zone: "zone-x", endpoint: "storage.example", cdn: "cdn.example" };
const SHOP = "0b6c1f2e-1111-4222-8333-444455556666";
const REQUEST = "7a1d2c3b-aaaa-4bbb-8ccc-ddddeeeeffff";

/** A fetch that records what it was asked and answers `status`. */
const recorder = (status = 201) => {
  const calls: { url: string; method: string; headers: Record<string, string> }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method ?? "GET", headers: init.headers as Record<string, string> });
    return new Response(null, { status });
  }) as unknown as typeof fetch;
  return { calls, impl };
};

describe("a client's request files (akinaza#210)", () => {
  it("a photo or a PDF, by its bytes; anything else is refused", () => {
    expect(detectRequestFile(jpeg)).toMatchObject({ kind: "image", ext: "jpg" });
    expect(detectRequestFile(pdf)).toEqual({ ext: "pdf", mime: "application/pdf", kind: "pdf" });
    for (const text of ["<svg/>", "<html>", "PK\u0003\u0004 a zip", ""]) expect(detectRequestFile(new TextEncoder().encode(text))).toBeNull();
    expect(MAX_REQUEST_FILE_BYTES).toBeLessThanOrEqual(5 * 1024 * 1024);
  });

  it("is stored content-hashed under the shop's requests/<id>/, and answered as its CDN address", async () => {
    const { calls, impl } = recorder();
    const stored = await storeRequestFile(SETTINGS, SHOP, REQUEST, pdf, impl);
    const key = requestFileKey(SHOP, REQUEST, pdf, "pdf");
    expect(key).toMatch(new RegExp(`^user/akinaza/shops/${SHOP}/requests/${REQUEST}/[0-9a-f]{16}\\.pdf$`));
    expect(stored).toEqual({ url: `https://cdn.example/${key}`, kind: "pdf" });
    expect(calls[0]).toMatchObject({ url: `https://storage.example/zone-x/${key}`, method: "PUT" });
  });

  it("deleting reaches only this zone's own files, and a file already gone counts as removed", async () => {
    const { calls, impl } = recorder(404);
    const key = requestFileKey(SHOP, REQUEST, jpeg, "jpg");
    expect(await deleteStored(SETTINGS, `https://cdn.example/${key}`, impl)).toBe(true);
    expect(calls).toEqual([{ url: `https://storage.example/zone-x/${key}`, method: "DELETE", headers: { AccessKey: "test-access-value" } }]);
    for (const url of ["https://elsewhere.example/user/akinaza/x.jpg", "https://cdn.example/site/home/backdrop.jpg", "https://cdn.example/user/akinaza/../../site/x"]) expect(await deleteStored(SETTINGS, url, impl)).toBe(false);
    expect(calls).toHaveLength(1);
  });
});
