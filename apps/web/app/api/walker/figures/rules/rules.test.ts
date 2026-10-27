import { saveShopFigureOverrides, shopFigureOverrides } from "@akinaza/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireOwner } from "@/lib/access";
import { audit } from "@/lib/audit";
import { refuse } from "@/lib/http";
import { appSettings } from "@/lib/settings";

import { GET, PUT } from "./route";

vi.mock("@/lib/access", () => ({ requireOwner: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: vi.fn(() => ({})) }));
vi.mock("@/lib/figure-rules", () => ({ adminFigureRules: vi.fn(async () => ({ defaults: { overdueWatchPct: 10, overdueAlertPct: 25, collectedWatchPct: 80, collectedAlertPct: 60, marginWatchPct: 30, marginAlertPct: 15, noShowWatchPct: 5, noShowAlertPct: 10, taxPeriodSoonDays: 14, maxActions: 3 }, offered: [] })) }));
vi.mock("@/lib/settings", () => ({ appSettings: vi.fn() }));
vi.mock("@akinaza/db", async (original) => ({ ...(await original<typeof import("@akinaza/db")>()), saveShopFigureOverrides: vi.fn(), shopFigureOverrides: vi.fn() }));

const put = (body: unknown) => PUT(new Request("http://localhost/api/walker/figures/rules", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

describe("the owner's figure thresholds (#260)", () => {
  beforeEach(() => {
    vi.mocked(requireOwner).mockResolvedValue({ session: { account: { id: "a", email: "o@example.com" } }, shop: { id: "s1" } } as never);
    vi.mocked(appSettings).mockReturnValue({ get: vi.fn(async () => true) } as never);
    vi.mocked(shopFigureOverrides).mockResolvedValue({ overdueWatchPct: 5 });
    vi.mocked(saveShopFigureOverrides).mockResolvedValue({});
  });
  afterEach(() => vi.clearAllMocks());

  it("reads the usual values, the owner's own and the bounds, never cached, only the tunable keys", async () => {
    const res = await GET(new Request("http://localhost/api/walker/figures/rules"));
    const json = await res.json();
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(json).toMatchObject({ tunable: true, overrides: { overdueWatchPct: 5 }, bounds: { overdueWatchPct: { min: 1, max: 99 } } });
    expect(json.defaults.overdueWatchPct).toBe(10);
    expect(json.defaults).not.toHaveProperty("maxActions");
  });

  it("keeps the thresholds in bounds, for this shop, and records who changed them", async () => {
    const res = await put({ overrides: { overdueWatchPct: 7, taxPeriodSoonDays: 30 } });
    expect(res.status).toBe(200);
    expect(saveShopFigureOverrides).toHaveBeenCalledWith({}, "s1", { overdueWatchPct: 7, taxPeriodSoonDays: 30 });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "shop.figure_rules_changed", targetId: "s1" }));
  });

  it("refuses a value out of bounds or a key that is not tunable, and saves nothing", async () => {
    for (const overrides of [{ overdueWatchPct: 0 }, { marginWatchPct: 100 }, { maxActions: 9 }, { noShowWatchPct: 2.5 }, { overdueAlertPct: "9" }]) {
      const res = await put({ overrides });
      expect(res.status, JSON.stringify(overrides)).toBe(400);
    }
    expect(saveShopFigureOverrides).not.toHaveBeenCalled();
  });

  it("is a 403 while the administrator keeps the thresholds", async () => {
    vi.mocked(appSettings).mockReturnValue({ get: vi.fn(async () => false) } as never);
    const res = await put({ overrides: { overdueWatchPct: 7 } });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FEATURE_OFF");
    expect(saveShopFigureOverrides).not.toHaveBeenCalled();
  });

  it("is the owner's: another shop's id or a staff member is refused by the guard", async () => {
    vi.mocked(requireOwner).mockRejectedValue(refuse(404, "NOT_FOUND", "Not found"));
    expect((await GET(new Request("http://localhost/api/walker/figures/rules?shopId=other"))).status).toBe(404);
    expect((await put({ overrides: {} })).status).toBe(404);
    expect(saveShopFigureOverrides).not.toHaveBeenCalled();
  });
});
