import { exploreQuerySchema } from "@akinaza/core";
import { exploreSearch } from "@akinaza/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

vi.mock("@/lib/db", () => ({ db: () => ({}) }));
vi.mock("@akinaza/db", async (original) => ({ ...(await original<typeof import("@akinaza/db")>()), exploreSearch: vi.fn() }));

const get = (qs: string) => GET(new Request(`http://localhost/api/explore/shops${qs}`, { headers: { "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 200)}` } }));

describe("GET /api/explore/shops (ADR-006)", () => {
  beforeEach(() => {
    vi.mocked(exploreSearch).mockReset();
    vi.mocked(exploreSearch).mockResolvedValue({ shops: [], next: null });
  });

  it("answers every shop by name with no parameter, cached by the edge", async () => {
    const response = await get("");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ shops: [], next: null });
    expect(vi.mocked(exploreSearch).mock.calls[0]![1]).toEqual(exploreQuerySchema.parse({}));
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=30");
  });

  it("hands the parsed filters to the search, and never lets a position into a shared cache", async () => {
    const response = await get("?q=coiffure&kind=salon&open=week&near=-73.58,45.48&within=3");
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=30");
    expect(vi.mocked(exploreSearch).mock.calls[0]![1]).toMatchObject({ q: "coiffure", kinds: ["salon"], open: "week", near: [-73.58, 45.48], within: 3 });
  });

  it.each(["?page=2", "?open=always", "?within=3", "?near=abc", "?limit=9999", "?q=a"])("refuses %s with a 400 and runs no query", async (qs) => {
    const response = await get(qs);
    expect(response.status).toBe(400);
    expect(exploreSearch).not.toHaveBeenCalled();
  });
});
