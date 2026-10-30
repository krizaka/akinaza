import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));
vi.mock("./session", async (orig) => ({ ...(await orig<typeof import("./session")>()), resolveSession: async () => null }));

// A signed-out caller is refused before any database or crypto work: the database is replaced by one that fails the test if it is touched. This also keeps the
// 401 from paying for the whole data layer's cold import (it measured ~5 s on a loaded machine, the timeout of a test), so the suite times the 401 itself.
vi.mock("@akinaza/db", () => new Proxy({}, { get: (_t, name) => (name === "then" ? undefined : () => { throw new Error(`a signed-out request touched the database (${String(name)})`); }) }));
vi.mock("./db", () => ({ db: () => { throw new Error("a signed-out request opened a database connection"); } }));

const get = (path: string) => new Request(`https://www.akinaza.com${path}`, { headers: { "x-forwarded-for": "203.0.113.9" } });

type Route = { GET: (req: Request) => Promise<Response> | Response };
const ROUTES: Record<string, () => Promise<Route>> = {
  day: () => import("../app/api/walker/day/route"),
  calendar: () => import("../app/api/walker/calendar/route"),
  clients: () => import("../app/api/walker/clients/route"),
  invoices: () => import("../app/api/walker/invoices/route"),
  shop: () => import("../app/api/walker/shop/route"),
};
const loaded = new Map<string, Route>();

describe("the owner's read routes for the apps", () => {
  // The cold import of the routes' modules (about 3 s the first time) is the suite's set-up, paid once here: each test then times the 401 alone.
  beforeAll(async () => {
    for (const [name, load] of Object.entries(ROUTES)) {loaded.set(name, await load());}
  });

  it.each([
    ["day", "/api/walker/day"],
    ["calendar", "/api/walker/calendar?from=2026-10-01&to=2026-10-31"],
    ["clients", "/api/walker/clients"],
    ["invoices", "/api/walker/invoices"],
    ["shop", "/api/walker/shop"],
  ])("answer 401 to a signed-out caller: %s", async (name, path) => {
    const route = loaded.get(name)!;
    const started = performance.now();
    expect((await route.GET(get(path))).status).toBe(401);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
