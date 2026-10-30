import { saveShopPage, ShopError } from "@akinaza/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireSession } from "@/lib/access";
import { appSettings } from "@/lib/settings";

import { POST } from "./route";

vi.mock("@/lib/access", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: vi.fn(() => ({})) }));
vi.mock("@/lib/settings", () => ({ appSettings: vi.fn() }));
const policy = { terms: [{ source: "login" }] };
vi.mock("@/lib/slug-policy", () => ({ slugPolicy: vi.fn(async () => policy) }));
vi.mock("@/lib/organize", () => ({ organize: vi.fn() }));
vi.mock("@akinaza/db", async (original) => ({ ...(await original<typeof import("@akinaza/db")>()), saveShopPage: vi.fn() }));

const page = { name: "Atelier", legalName: "Atelier inc.", address: "1 rue X", slug: "atelier-c", ownerName: "Éric", published: false };
const post = () => POST(new Request("http://localhost/api/walker/shops", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(page) }));

describe("POST /api/walker/shops goes through the same shop limit (#265)", () => {
  beforeEach(() => {
    vi.mocked(requireSession).mockResolvedValue({ id: "s", account: { id: "owner", email: "o@example.com", role: "USER", locale: "en" } });
    vi.mocked(appSettings).mockReturnValue({ get: vi.fn(async () => 3) } as never);
    vi.mocked(saveShopPage).mockResolvedValue({ shopId: "new", created: true, held: false });
  });
  afterEach(() => vi.clearAllMocks());

  it("hands the administrator's bound to the service, which is where it is enforced", async () => {
    expect((await post()).status).toBe(201);
    expect(vi.mocked(saveShopPage).mock.calls[0]![3]).toEqual({ additional: true, maxShops: 3 });
  });

  it("answers the refusal at the limit as 409 SHOP_LIMIT", async () => {
    vi.mocked(saveShopPage).mockRejectedValue(new ShopError("AK_SHOP_LIMIT"));
    const res = await post();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("SHOP_LIMIT");
  });
});
