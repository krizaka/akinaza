import { saveShopPage, ShopError } from "@akinaza/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireSession } from "@/lib/access";
import { appSettings } from "@/lib/settings";
import { createShopDirectory, type ShopVerdict } from "@/lib/shop-directory";

import { POST } from "./route";

vi.mock("@/lib/access", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: vi.fn(() => ({})) }));
vi.mock("@/lib/settings", () => ({ appSettings: vi.fn() }));
const policy = { terms: [{ source: "login" }] };
vi.mock("@/lib/slug-policy", () => ({ slugPolicy: vi.fn(async () => policy) }));
vi.mock("@akinaza/db", async (original) => ({ ...(await original<typeof import("@akinaza/db")>()), saveShopPage: vi.fn() }));

const page = { name: "Atelier", legalName: "Atelier inc.", address: "1 rue X", slug: "atelier-b", ownerName: "Éric", published: true };
const post = (query = "") => POST(new Request(`http://localhost/api/walker/shop${query}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(page) }));

describe("adding a shop (#265)", () => {
  beforeEach(() => {
    vi.mocked(requireSession).mockResolvedValue({ id: "s", account: { id: "owner", email: "o@example.com", role: "USER", locale: "en" } });
    vi.mocked(appSettings).mockReturnValue({ get: vi.fn(async () => 2) } as never);
    vi.mocked(saveShopPage).mockResolvedValue({ shopId: "new", created: true, held: false });
  });
  afterEach(() => vi.clearAllMocks());

  it("creates one more shop, unpublished, for the signed-in account only, under the administrator's bound", async () => {
    const res = await post("?additional=1");
    expect(res.status).toBe(201);
    expect(vi.mocked(saveShopPage).mock.calls[0]).toMatchObject([expect.anything(), "owner", { published: false, slug: "atelier-b" }, { additional: true, maxShops: 2 }, policy]);
  });

  it("hands the administrator's protected terms to every save, so an address wearing one is held (#537)", async () => {
    await post("?additional=1");
    expect(vi.mocked(saveShopPage).mock.calls[0]![4]).toBe(policy);
    await post();
    expect(vi.mocked(saveShopPage).mock.calls[1]![4]).toBe(policy);
  });

  it("answers the service's refusal at the limit as a plain 409 SHOP_LIMIT", async () => {
    vi.mocked(saveShopPage).mockRejectedValue(new ShopError("AK_SHOP_LIMIT"));
    const res = await post("?additional=1");
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("SHOP_LIMIT");
  });

  it("is either a shop or a new one, never both", async () => {
    expect((await post(`?additional=1&shopId=${crypto.randomUUID()}`)).status).toBe(400);
  });

  it("without `additional` it is still the update of the default shop", async () => {
    vi.mocked(saveShopPage).mockResolvedValue({ shopId: "a", created: false, held: false });
    await post();
    expect(vi.mocked(saveShopPage).mock.calls[0]![3]).toEqual({});
  });

  it("forgets what the shop hosts' memory knows, so a published, unpublished or renamed shop answers from the database at once (#549)", async () => {
    vi.mocked(saveShopPage).mockResolvedValue({ shopId: "a", created: false });
    let verdict: ShopVerdict = { kind: "shop" };
    const lookup = vi.fn(async () => verdict);
    const proxySide = createShopDirectory(lookup);
    await proxySide("atelier-b");
    verdict = { kind: "none" };
    expect(await proxySide("atelier-b")).toEqual({ kind: "shop" });
    await post();
    expect(await proxySide("atelier-b")).toEqual({ kind: "none" });
  });
});
