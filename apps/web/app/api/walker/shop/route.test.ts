import { saveShopPage, shopsOfOwner } from "@akinaza/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireSession } from "@/lib/access";
import { appSettings } from "@/lib/settings";

import { POST } from "./route";

vi.mock("@/lib/access", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: vi.fn(() => ({})) }));
vi.mock("@/lib/settings", () => ({ appSettings: vi.fn() }));
vi.mock("@akinaza/db", async (original) => ({ ...(await original<typeof import("@akinaza/db")>()), saveShopPage: vi.fn(), shopsOfOwner: vi.fn() }));

const page = { name: "Atelier", legalName: "Atelier inc.", address: "1 rue X", slug: "atelier-b", ownerName: "Éric", published: true };
const post = (query = "") => POST(new Request(`http://localhost/api/walker/shop${query}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(page) }));

describe("adding a shop (#265)", () => {
  beforeEach(() => {
    vi.mocked(requireSession).mockResolvedValue({ id: "s", account: { id: "owner", email: "o@example.com", role: "USER", locale: "en" } });
    vi.mocked(appSettings).mockReturnValue({ get: vi.fn(async () => 2) } as never);
    vi.mocked(saveShopPage).mockResolvedValue({ shopId: "new", created: true });
  });
  afterEach(() => vi.clearAllMocks());

  it("creates one more shop, unpublished, for the signed-in account only", async () => {
    vi.mocked(shopsOfOwner).mockResolvedValue([{ id: "a" }] as never);
    const res = await post("?additional=1");
    expect(res.status).toBe(201);
    expect(vi.mocked(saveShopPage).mock.calls[0]).toMatchObject([expect.anything(), "owner", { published: false, slug: "atelier-b" }, { additional: true }]);
  });

  it("refuses past the administrator's limit, with a plain code", async () => {
    vi.mocked(shopsOfOwner).mockResolvedValue([{ id: "a" }, { id: "b" }] as never);
    const res = await post("?additional=1");
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "SHOP_LIMIT", max: 2 });
    expect(saveShopPage).not.toHaveBeenCalled();
  });

  it("is either a shop or a new one, never both", async () => {
    expect((await post(`?additional=1&shopId=${crypto.randomUUID()}`)).status).toBe(400);
  });

  it("without `additional` it is still the update of the default shop", async () => {
    vi.mocked(saveShopPage).mockResolvedValue({ shopId: "a", created: false });
    await post();
    expect(vi.mocked(saveShopPage).mock.calls[0]![3]).toEqual({});
    expect(shopsOfOwner).not.toHaveBeenCalled();
  });
});
