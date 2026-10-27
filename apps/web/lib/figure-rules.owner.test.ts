import { DEFAULT_FIGURE_THRESHOLDS } from "@akinaza/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { figureRules } from "./figure-rules";
import { appSettings } from "./settings";

vi.mock("@/lib/settings", () => ({ appSettings: vi.fn() }));
const shopFigureOverrides = vi.fn();

const settings = (tunable: boolean) => vi.mocked(appSettings).mockReturnValue({ get: vi.fn(async (key: string) => (key === "figures.ownerTunable" ? tunable : key === "figures.actions" ? ["chase", "taxes", "slot"] : DEFAULT_FIGURE_THRESHOLDS[key.replace("figures.", "") as keyof typeof DEFAULT_FIGURE_THRESHOLDS])) } as never);

describe("the thresholds a shop's figures are judged by (#260)", () => {
  afterEach(() => vi.clearAllMocks());

  it("puts the owner's thresholds over the administrator's", async () => {
    settings(true);
    shopFigureOverrides.mockResolvedValue({ overdueWatchPct: 5, taxPeriodSoonDays: 30 });
    const { thresholds } = await figureRules(shopFigureOverrides);
    expect(thresholds).toMatchObject({ overdueWatchPct: 5, taxPeriodSoonDays: 30, marginWatchPct: DEFAULT_FIGURE_THRESHOLDS.marginWatchPct });
    expect(shopFigureOverrides).toHaveBeenCalledTimes(1);
  });

  it("ignores them, and does not even read them, while the administrator keeps the thresholds", async () => {
    settings(false);
    shopFigureOverrides.mockResolvedValue({ overdueWatchPct: 5 });
    const { thresholds } = await figureRules(shopFigureOverrides);
    expect(thresholds).toEqual(DEFAULT_FIGURE_THRESHOLDS);
    expect(shopFigureOverrides).not.toHaveBeenCalled();
  });

  it("is the shop's own: no overrides is the usual values", async () => {
    settings(true);
    shopFigureOverrides.mockResolvedValue({});
    expect((await figureRules(shopFigureOverrides)).thresholds).toEqual(DEFAULT_FIGURE_THRESHOLDS);
  });
});
