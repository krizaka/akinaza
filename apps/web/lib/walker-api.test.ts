import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));
vi.mock("./session", async (orig) => ({ ...(await orig<typeof import("./session")>()), resolveSession: async () => null }));

const get = (path: string) => new Request(`https://www.akinaza.com${path}`, { headers: { "x-forwarded-for": "203.0.113.9" } });

describe("the owner's read routes for the apps", () => {
  it.each([
    ["day", "/api/walker/day"],
    ["calendar", "/api/walker/calendar?from=2026-10-01&to=2026-10-31"],
    ["clients", "/api/walker/clients"],
    ["invoices", "/api/walker/invoices"],
    ["shop", "/api/walker/shop"],
  ])("answer 401 to a signed-out caller: %s", async (name, path) => {
    const route = await import(`../app/api/walker/${name}/route`);
    expect((await route.GET(get(path))).status).toBe(401);
  });
});
