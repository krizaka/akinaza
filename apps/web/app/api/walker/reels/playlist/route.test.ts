import { reorderReels, setReelTransition } from "@akinaza/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireShop } from "@/lib/access";

import { PUT } from "./route";

vi.mock("@/lib/access", () => ({ requireShop: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/community", () => ({ assertShopFeature: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: () => ({}) }));
vi.mock("@/lib/realtime", () => ({ announcePage: vi.fn() }));
vi.mock("@akinaza/db", () => ({ reorderReels: vi.fn(), setReelTransition: vi.fn() }));

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const put = (json: unknown) => PUT(new Request("http://localhost/api/walker/reels/playlist", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(json) }));

describe("the television's playlist (#469)", () => {
  beforeEach(() => {
    vi.mocked(requireShop).mockResolvedValue({ session: { account: { id: "a", email: "o@example.com" } }, shop: { id: "s1" }, role: "owner" } as never);
    vi.mocked(reorderReels).mockReset().mockResolvedValue(true);
    vi.mocked(setReelTransition).mockReset().mockResolvedValue(undefined);
  });

  it("puts the videos in the order asked, for this shop only", async () => {
    expect((await put({ order: [B, A] })).status).toBe(200);
    expect(reorderReels).toHaveBeenCalledWith({}, "s1", [B, A]);
    expect(setReelTransition).not.toHaveBeenCalled();
  });

  it("answers 409 and changes nothing when the order is not exactly the shop's videos", async () => {
    vi.mocked(reorderReels).mockResolvedValue(false);
    const res = await put({ order: [A], transition: "slide" });
    expect(res.status).toBe(409);
    expect(setReelTransition).not.toHaveBeenCalled();
  });

  it("keeps one of the three transitions and refuses any other, or an empty request", async () => {
    expect((await put({ transition: "crossfade" })).status).toBe(200);
    expect(setReelTransition).toHaveBeenCalledWith({}, "s1", "crossfade");
    expect((await put({ transition: "spin" })).status).toBe(400);
    expect((await put({})).status).toBe(400);
    expect((await put({ order: ["not-an-id"] })).status).toBe(400);
  });
});
