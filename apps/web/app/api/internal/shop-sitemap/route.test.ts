import { beforeEach, describe, expect, it, vi } from "vitest";

const publicShop = vi.fn();
vi.mock("@akinaza/db", () => ({ publicShop: (...args: unknown[]) => publicShop(...args) }));
vi.mock("@/lib/db", () => ({ db: () => ({}) }));

import { GET } from "./route";

const ask = (host: string, url = "http://localhost:3000/api/internal/shop-sitemap") => GET(new Request(url, { headers: { host } }));

// A route handler reads the URL the client asked, never the query of the proxy's rewrite: the shop is the one the Host names (found on a real server, #563).
describe("a shop host's sitemap route", () => {
  beforeEach(() => {
    publicShop.mockReset();
    vi.stubEnv("APP_SHOP_DOMAIN", "shops.localhost");
    vi.stubEnv("APP_PUBLIC_URL", "http://localhost:3001");
    publicShop.mockResolvedValue({ languages: { enabled: ["fr", "en"] } });
  });

  it("answers the sitemap of the shop the Host names, with no query", async () => {
    const res = await ask("pattes-saint-henri.shops.localhost:3001");
    expect(res.status).toBe(200);
    expect(publicShop).toHaveBeenCalledWith(expect.anything(), "pattes-saint-henri");
    expect(await res.text()).toContain("<loc>http://pattes-saint-henri.shops.localhost:3001/fr</loc>");
  });

  it("is a 404 for a host that names no shop, and for a shop that is not public", async () => {
    expect((await ask("localhost:3001")).status).toBe(404);
    expect(publicShop).not.toHaveBeenCalled();
    publicShop.mockResolvedValue(null);
    expect((await ask("pattes-saint-henri.shops.localhost:3001")).status).toBe(404);
  });
});
