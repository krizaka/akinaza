import { booksAnswer } from "@akinaza/core";
import { prepareShopReturn, shopDay } from "@akinaza/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireShop } from "@/lib/access";
import { refuse } from "@/lib/http";

import { GET } from "./route";

vi.mock("@/lib/access", () => ({ requireShop: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: vi.fn(() => ({})) }));
vi.mock("@akinaza/db", async (original) => ({ ...(await original<typeof import("@akinaza/db")>()), prepareShopReturn: vi.fn(), shopDay: vi.fn() }));

const get = (query = "") => GET(new Request(`http://localhost/api/walker/books${query}`));

describe("« Livres » for the apps (D8): the period's prepared GST/QST, never a filing", () => {
  beforeEach(() => {
    vi.mocked(requireShop).mockResolvedValue({ shop: { id: "s1" }, role: "owner", session: { account: { id: "a1" } } } as never);
    vi.mocked(shopDay).mockResolvedValue("2026-10-25");
    vi.mocked(prepareShopReturn).mockResolvedValue({ lines: [], gstNetCents: 1_250, qstNetCents: -2_494 } as never);
  });
  afterEach(() => vi.clearAllMocks());

  it("prepares the latest completed quarter by default, for a member who may read the reports", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const body = booksAnswer.parse(await res.json());
    expect(vi.mocked(requireShop).mock.calls[0]![1]).toBe("reports");
    expect(vi.mocked(prepareShopReturn).mock.calls[0]!.slice(1)).toEqual(["s1", "2026-07-01", "2026-09-30"]);
    expect(body).toMatchObject({ period: { id: "2026-Q3" }, gst: { netCents: 1_250, outcome: "remit" }, qst: { netCents: 2_494, outcome: "claim" }, preparedOnly: true });
    expect(body.choices[0]).toBe("2026-Q3");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("reads the period of the address, a month or a quarter", async () => {
    await get("?period=2026-02");
    expect(vi.mocked(prepareShopReturn).mock.calls[0]!.slice(2)).toEqual(["2026-02-01", "2026-02-28"]);
  });

  it("answers the guard's refusal: another shop is a 404", async () => {
    vi.mocked(requireShop).mockRejectedValue(refuse(404, "NOT_FOUND", "Not found"));
    expect((await get("?shopId=6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b")).status).toBe(404);
  });
});
