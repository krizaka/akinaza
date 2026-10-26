import { memoryPriceStore, priceCatalogue } from "@krizaka/settings";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdmin } from "@/lib/access";
import { appPrices } from "@/lib/price-catalogue";
import { PRICES, STARTER } from "@/lib/pricing";

import { POST } from "./route";

vi.mock("@/lib/access", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/price-catalogue", () => ({ appPrices: vi.fn() }));

const post = (key: string, body: unknown) => POST(new Request(`http://localhost/api/admin/prices/${key}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), { params: Promise.resolve({ key }) });

describe("POST /api/admin/prices/[key]: the administrator schedules a change from a date (akinaza#371)", () => {
  let prices: ReturnType<typeof priceCatalogue>;
  beforeEach(() => {
    prices = priceCatalogue(PRICES, memoryPriceStore());
    vi.mocked(requireAdmin).mockResolvedValue({ account: { id: "00000000-0000-0000-0000-000000000001", email: "admin@example.com" } } as never);
    vi.mocked(appPrices).mockReturnValue(prices);
  });
  afterEach(() => vi.clearAllMocks());

  it("schedules a new version from a later date, with its history line; the price in force stays until then", async () => {
    const res = await post(STARTER, { amountCents: 5000, effectiveFrom: "2099-01-01T05:00:00.000Z" });
    expect(res.status).toBe(200);
    expect((await prices.entry(STARTER, new Date())).amountCents).toBe(4500);
    expect((await prices.entry(STARTER, new Date("2099-02-01"))).amountCents).toBe(5000);
    const [line] = await prices.history(STARTER);
    expect(line).toMatchObject({ actorLabel: "admin@example.com", before: { amountCents: 4500 }, after: { amountCents: 5000 } });
  });

  it("refuses a date in the past, an unknown entry and an on-sale entry without a figure", async () => {
    expect((await post(STARTER, { amountCents: 5000, effectiveFrom: "2000-01-01T00:00:00.000Z" })).status).toBe(400);
    expect((await post("akinaza.nope", { amountCents: 5000 })).status).toBe(404);
    expect((await post(STARTER, { amountCents: null })).status).toBe(400);
    expect((await post(STARTER, { fee: 3 })).status).toBe(400);
  });
});
