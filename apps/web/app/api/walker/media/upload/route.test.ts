import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireOwner } from "@/lib/access";
import { appSettings } from "@/lib/settings";

import { POST } from "./route";

vi.mock("@/lib/access", () => ({ requireOwner: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/settings", () => ({ appSettings: vi.fn() }));

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const upload = (purpose: string) => {
  const form = new FormData();
  form.set("file", new File([JPEG], "a.jpg", { type: "image/jpeg" }));
  form.set("purpose", purpose);
  return POST(new Request("http://localhost/api/walker/media/upload", { method: "POST", body: form }));
};

describe("storefront media upload follows the administrator's switches", () => {
  let on: Record<string, boolean>;
  beforeEach(() => {
    on = {};
    vi.stubEnv("MEDIA_STORAGE_API_KEY", "k");
    vi.stubEnv("MEDIA_STORAGE_ZONE", "z");
    vi.stubEnv("MEDIA_CDN_HOSTNAME", "cdn.example");
    vi.mocked(requireOwner).mockResolvedValue({ session: { account: { id: "a", email: "o@example.com" } }, shop: { id: "s1" } } as never);
    vi.mocked(appSettings).mockReturnValue({ get: vi.fn(async (key: string) => on[key] ?? false) } as never);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 201 })));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each([["wall", "features.shopWall"], ["reels", "features.shopReels"], ["announcements", "features.shopAnnouncements"]])("refuses %s while %s is off, accepts it once on", async (purpose, key) => {
    expect((await upload(purpose)).status).toBe(403);
    on[key] = true;
    expect((await upload(purpose)).status).toBe(200);
  });

  it("never gates the shop's own brand, cards and gallery", async () => {
    for (const purpose of ["brand", "cards", "gallery"]) expect((await upload(purpose)).status).toBe(200);
  });
});
