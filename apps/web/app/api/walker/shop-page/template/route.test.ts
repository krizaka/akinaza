import { applyTemplate, ShopError, shopPageConfigOf } from "@akinaza/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireOwner } from "@/lib/access";
import { templateRules } from "@/lib/template-rules";

import { POST } from "./route";

vi.mock("@/lib/access", () => ({ requireOwner: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: vi.fn(() => ({})) }));
vi.mock("@/lib/template-rules", () => ({ templateRules: vi.fn(), templateCatalogue: vi.fn(async () => []) }));
vi.mock("@akinaza/db", async (original) => ({ ...(await original<typeof import("@akinaza/db")>()), applyTemplate: vi.fn(), shopPageConfigOf: vi.fn() }));

const post = (body: unknown) => POST(new Request("http://localhost/api/walker/shop-page/template", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

describe("applying a template over HTTP (#261)", () => {
  beforeEach(() => {
    vi.mocked(requireOwner).mockResolvedValue({ session: { account: { id: "a", email: "o@example.com" } }, shop: { id: "s1" } } as never);
    vi.mocked(templateRules).mockResolvedValue({ enabled: true, offered: ["salon-carte"], defaults: {} as never });
    vi.mocked(applyTemplate).mockResolvedValue({ id: "salon-carte", version: 1 } as never);
    vi.mocked(shopPageConfigOf).mockResolvedValue({ templateId: "salon-carte" } as never);
  });
  afterEach(() => vi.clearAllMocks());

  it("is a 403 while the administrator's switch is off, and applies nothing", async () => {
    vi.mocked(templateRules).mockResolvedValue({ enabled: false, offered: ["salon-carte"], defaults: {} as never });
    const res = await post({ templateId: "salon-carte" });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FEATURE_OFF");
    expect(applyTemplate).not.toHaveBeenCalled();
  });

  it("applies to the owner's own shop (never one named in the body), inside the templates the administrator offers", async () => {
    const res = await post({ templateId: "salon-carte", keepOrder: true, shopId: "another-shop" });
    expect(res.status).toBe(200);
    expect(vi.mocked(applyTemplate).mock.calls[0]).toMatchObject([expect.anything(), "s1", { templateId: "salon-carte", keepOrder: true, offered: ["salon-carte"] }, []]);
  });

  it("answers a customised page with 409 SECTIONS_CUSTOM and an unknown template with 404 TEMPLATE_UNKNOWN", async () => {
    vi.mocked(applyTemplate).mockRejectedValueOnce(new ShopError("AK_SECTIONS_CUSTOM"));
    const custom = await post({ templateId: "salon-carte" });
    expect([custom.status, (await custom.json()).code]).toEqual([409, "SECTIONS_CUSTOM"]);
    vi.mocked(applyTemplate).mockRejectedValueOnce(new ShopError("AK_TEMPLATE_UNKNOWN"));
    const unknown = await post({ templateId: "nope-nope" });
    expect([unknown.status, (await unknown.json()).code]).toEqual([404, "TEMPLATE_UNKNOWN"]);
  });

  it("refuses a malformed id before anything else", async () => {
    expect((await post({ templateId: "Salon Carte" })).status).toBe(400);
    expect(applyTemplate).not.toHaveBeenCalled();
  });
});
