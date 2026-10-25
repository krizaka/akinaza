import { describe, expect, it } from "vitest";

import { createAkinazaApi } from "./api";
import { keys } from "./queries";

const DAY = { shopId: "s1", timezone: "America/Toronto", day: "2026-10-20", visits: [] };
const BOOKS = { period: { id: "2026-Q3", start: "2026-07-01", end: "2026-09-30" }, choices: ["2026-Q3", "2026-Q2"], gst: { netCents: 1_250, outcome: "remit" }, qst: { netCents: 2_494, outcome: "remit" }, preparedOnly: true };

/** A fake transport: what the app asked for, and the answer it gets. */
function fake(answer: unknown) {
  const asked: { path: string; method?: string }[] = [];
  const api = createAkinazaApi({ call: async <T,>(path: string, init?: { method?: string }) => (asked.push({ path, method: init?.method }), answer as T) }, { saveToken: async () => undefined, clearToken: async () => undefined });
  return { api, asked };
}

describe("the owner's API is the shop's of the address (D8: the app's paths carry the shop, as the web's)", () => {
  it("names the shop with `?shopId=` on every call of the shop's space", async () => {
    const { api, asked } = fake(DAY);
    await api.day("2026-10-20", "s1");
    await api.day(undefined, "s1");
    expect(asked.map((a) => a.path)).toEqual(["/api/walker/day?date=2026-10-20&shopId=s1", "/api/walker/day?shopId=s1"]);
  });

  it("asks the shop the server picks when the address names none", async () => {
    const { api, asked } = fake(DAY);
    await api.day();
    expect(asked[0]!.path).toBe("/api/walker/day");
  });

  it("reads « Livres »: the period's prepared GST and QST, never a filing", async () => {
    const { api, asked } = fake(BOOKS);
    const books = await api.books("2026-Q3", "s1");
    expect(asked[0]!.path).toBe("/api/walker/books?period=2026-Q3&shopId=s1");
    expect(books).toMatchObject({ gst: { netCents: 1_250, outcome: "remit" }, preparedOnly: true });
  });

  it("refuses an answer that is not the promised shape", async () => {
    const { api } = fake({ period: "2026-Q3" });
    await expect(api.books(undefined, "s1")).rejects.toThrow();
  });

  it("keys the server state by shop, so two shops never share a cache entry", () => {
    expect(keys.day("2026-10-20", "s1")).not.toEqual(keys.day("2026-10-20", "s2"));
    expect(keys.books("2026-Q3", "s1")).not.toEqual(keys.books("2026-Q3", "s2"));
  });
});
