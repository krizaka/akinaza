import { saveShopLanguages, translateShop } from "@akinaza/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireOwner } from "@/lib/access";
import { translationRules } from "@/lib/translation-settings";

import { PUT as languages } from "./route";
import { POST as run } from "./run/route";

vi.mock("@/lib/access", () => ({ requireOwner: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: vi.fn(() => ({})) }));
vi.mock("@/lib/translation-settings", () => ({ translationRules: vi.fn() }));
vi.mock("@akinaza/db", async (original) => ({ ...(await original<typeof import("@akinaza/db")>()), translateShop: vi.fn(), saveShopLanguages: vi.fn() }));

const post = (route: (req: Request) => Promise<Response>, body: unknown) => route(new Request("http://localhost/api/walker/translations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
const put = (body: unknown) => languages(new Request("http://localhost/api/walker/translations", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

describe("the shop page's translation routes (#258)", () => {
  beforeEach(() => {
    vi.mocked(requireOwner).mockResolvedValue({ session: { account: { id: "a", email: "o@example.com" } }, shop: { id: "s1" } } as never);
    vi.mocked(translationRules).mockResolvedValue({ enabled: true, allowed: ["fr", "en"], dailyLimit: 5 });
  });
  afterEach(() => vi.clearAllMocks());

  it("« Traduire » is a 403 while the administrator's switch is off, and never reaches the port", async () => {
    vi.mocked(translationRules).mockResolvedValue({ enabled: false, allowed: ["fr", "en", "es"], dailyLimit: 5 });
    const res = await post(run, { locale: "es" });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FEATURE_OFF");
    expect(translateShop).not.toHaveBeenCalled();
  });

  it("runs through the Orazaka port with the administrator's daily limit, and answers 503 while the Studio is not wired", async () => {
    vi.mocked(translateShop).mockImplementation(async (_db, port, input) => {
      expect(input).toMatchObject({ shopId: "s1", locale: "es", dailyLimit: 5 });
      await port.translate({ from: "fr", to: "es", glossary: [], texts: [] });
      throw new Error("unreachable: the real adapter refuses");
    });
    const res = await post(run, { locale: "es" });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: "TRANSLATION_UNAVAILABLE", reason: "not-wired" });
  });

  it("only the owner's own shop is addressed: the shop comes from the guard, never from the body", async () => {
    vi.mocked(translateShop).mockResolvedValue({ runId: "r", stored: [], skippedEdited: [], nothingToDo: true });
    await post(run, { locale: "en", shopId: "another-shop" });
    expect(vi.mocked(translateShop).mock.calls[0]![2].shopId).toBe("s1");
  });

  it("the languages are saved inside the administrator's list", async () => {
    vi.mocked(saveShopLanguages).mockResolvedValue({ source: "fr", enabled: ["fr", "en"] });
    expect((await put({ source: "fr", enabled: ["en"] })).status).toBe(200);
    expect(vi.mocked(saveShopLanguages).mock.calls[0]![3]).toEqual(["fr", "en"]);
    expect((await put({ source: "es", enabled: [] })).status).toBe(400);
  });
});
