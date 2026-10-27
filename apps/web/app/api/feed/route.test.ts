import { feedFlyers } from "@akinaza/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimits } from "@/lib/rate-limit";
import { shopSectionFeatures } from "@/lib/settings";

import { GET } from "./route";

vi.mock("@akinaza/db", () => ({ feedFlyers: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: () => ({}) }));
vi.mock("@/lib/settings", () => ({ shopSectionFeatures: vi.fn() }));

const rows = [
  { id: "a", textFr: "Portes ouvertes", textEn: "Open day", photoUrl: null, photoAlt: "", endsOn: null, createdAt: new Date(), shopName: "Atelier", shopSlug: "atelier", area: "Saint-Henri, Montréal" },
  { id: "b", textFr: "Nouveau", textEn: "New", photoUrl: null, photoAlt: "", endsOn: null, createdAt: new Date(), shopName: "Salon", shopSlug: "salon", area: "Villeray, Montréal" },
];
const get = (query = "") => GET(new Request(`http://localhost/api/feed${query}`));

describe("GET /api/feed (#318)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimits();
    vi.mocked(feedFlyers).mockResolvedValue(rows as never);
    vi.mocked(shopSectionFeatures).mockResolvedValue({ announcements: true } as never);
  });

  it("is public and cacheable, and carries only the flyer, its shop's name and its page", async () => {
    const res = await get("?locale=fr");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("s-maxage");
    const body = await res.json();
    expect(body.flyers).toHaveLength(2);
    expect(Object.keys(body.flyers[0]).sort()).toEqual(["id", "shop", "text", "until"]);
    expect(body.flyers[0].shop).toEqual({ name: "Atelier", href: "/fr/s/atelier" });
  });

  it("filters by neighbourhood", async () => {
    const body = await (await get("?quartier=Villeray&locale=en")).json();
    expect(body.flyers.map((f: { id: string }) => f.id)).toEqual(["b"]);
    expect(body.quartiers).toEqual(["Saint-Henri", "Villeray"]);
  });

  it("is empty when the administrator turned the bulletin board off", async () => {
    vi.mocked(shopSectionFeatures).mockResolvedValue({ announcements: false } as never);
    expect((await (await get()).json()).flyers).toEqual([]);
    expect(feedFlyers).not.toHaveBeenCalled();
  });

  it("slows a flood down", async () => {
    for (let i = 0; i < 120; i++) await get();
    expect((await get()).status).toBe(429);
  });
});
