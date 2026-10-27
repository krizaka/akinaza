import { figuresAnswer } from "@akinaza/core";
import { shopDay } from "@akinaza/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireShop } from "@/lib/access";
import { refuse } from "@/lib/http";

import { GET } from "./route";

vi.mock("@/lib/access", () => ({ requireShop: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: vi.fn(() => ({})) }));
vi.mock("@/lib/figures", () => ({ loadFigures: vi.fn(async () => ({ figures: { invoiced: { id: "invoiced", value: 30_000, unit: "cents", rate: null, formula: [], lexicon: [], sources: [], period: null, computedAt: "2026-10-23T12:00:00.000Z", cadence: "onChange", staleAfterHours: 24, state: "info" } }, actions: [{ kind: "chase", urgency: "now", impactCents: 100, why: {}, target: { route: "invoices" }, evidence: [] }], period: { start: "2026-10-01", end: "2026-12-31" } })) }));
vi.mock("@akinaza/db", async (original) => ({ ...(await original<typeof import("@akinaza/db")>()), shopDay: vi.fn() }));

describe("the figures for the apps (#260)", () => {
  beforeEach(() => {
    vi.mocked(requireShop).mockResolvedValue({ shop: { id: "s1" }, role: "owner", session: { account: { id: "a1" } } } as never);
    vi.mocked(shopDay).mockResolvedValue("2026-10-23");
  });
  afterEach(() => vi.clearAllMocks());

  it("answers the period, the figures and the actions, for who may read the reports, never cached", async () => {
    const res = await GET(new Request("http://localhost/api/walker/figures"));
    expect(res.status).toBe(200);
    expect(vi.mocked(requireShop).mock.calls[0]![1]).toBe("reports");
    expect(await res.json()).toMatchObject({ period: { start: "2026-10-01" }, figures: [{ id: "invoiced", value: 30_000 }], actions: [{ kind: "chase" }] });
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("answers what the apps parse: a list of figures, never the record keyed by id (#433: the phone stayed on Loading)", async () => {
    const res = await GET(new Request("http://localhost/api/walker/figures"));
    expect(figuresAnswer.safeParse(await res.json()).success).toBe(true);
  });

  it("answers the guard's refusal: another shop is a 404", async () => {
    vi.mocked(requireShop).mockRejectedValue(refuse(404, "NOT_FOUND", "Not found"));
    expect((await GET(new Request("http://localhost/api/walker/figures?shopId=other"))).status).toBe(404);
  });
});
