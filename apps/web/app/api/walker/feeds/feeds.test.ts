import { feedPeople, liveFeeds, revokeFeedToken, rotateFeedToken } from "@akinaza/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { refuse } from "@/lib/http";
import { appSettings } from "@/lib/settings";

import { DELETE, GET, POST } from "./route";

vi.mock("@/lib/access", async (original) => ({ ...(await original<typeof import("@/lib/access")>()), requireShop: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: vi.fn(() => ({})) }));
vi.mock("@/lib/settings", () => ({ appSettings: vi.fn() }));
vi.mock("@akinaza/db", async (original) => ({ ...(await original<typeof import("@akinaza/db")>()), feedPeople: vi.fn(), liveFeeds: vi.fn(), rotateFeedToken: vi.fn(), revokeFeedToken: vi.fn() }));

const STAFF = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const send = (route: (req: Request) => Promise<Response>, method: string, json: unknown) => route(new Request("http://localhost/api/walker/feeds", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(json) }));
const asRole = (role: "owner" | "manager" | "staff") => vi.mocked(requireShop).mockResolvedValue({ role, shop: { id: "s1" }, session: { account: { id: "acc", email: "o@example.com" } } } as never);

describe("managing the private feeds (#282)", () => {
  beforeEach(() => {
    asRole("owner");
    vi.mocked(appSettings).mockReturnValue({ get: vi.fn(async () => true) } as never);
    vi.mocked(feedPeople).mockResolvedValue([{ id: STAFF, name: "Julie" }]);
    vi.mocked(liveFeeds).mockResolvedValue([{ id: "f", shopId: "s1", staffId: null, createdAt: new Date("2026-10-26T12:00:00Z"), rotatedAt: null }]);
    vi.mocked(rotateFeedToken).mockResolvedValue({ id: "f2", shopId: "s1", staffId: null, createdAt: new Date("2026-10-26T13:00:00Z"), rotatedAt: null });
    vi.mocked(revokeFeedToken).mockResolvedValue(true);
  });
  afterEach(() => vi.clearAllMocks());

  it("says which feeds are live, and never an address", async () => {
    const json = await (await GET(new Request("http://localhost/api/walker/feeds"))).json();
    expect(json).toMatchObject({ enabled: true, shop: { live: true }, people: [{ id: STAFF, name: "Julie", live: false }] });
    expect(JSON.stringify(json)).not.toMatch(/kf1\.|\/api\/feed\//);
  });

  it("makes an address once: the answer holds it, the table keeps only its hash, and the change is audited", async () => {
    const res = await send(POST, "POST", {});
    const json = await res.json();
    expect(json.url).toMatch(/\/api\/feed\/kf1\.[A-Za-z0-9_-]{43}\.ics$/);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const stored = vi.mocked(rotateFeedToken).mock.calls[0]![2];
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    expect(json.url).not.toContain(stored);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "shop.feed_created", targetId: "s1" }));
  });

  it("audits a rotation as one", async () => {
    vi.mocked(rotateFeedToken).mockResolvedValue({ id: "f3", shopId: "s1", staffId: STAFF, createdAt: new Date(), rotatedAt: new Date() });
    expect((await send(POST, "POST", { staffId: STAFF })).status).toBe(200);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "shop.feed_rotated" }));
  });

  it("refuses a staff member who is not the shop's (404), for every role", async () => {
    for (const role of ["owner", "manager"] as const) {
      asRole(role);
      expect((await send(POST, "POST", { staffId: OTHER })).status).toBe(404);
      expect((await send(DELETE, "DELETE", { staffId: OTHER })).status).toBe(404);
    }
    expect(rotateFeedToken).not.toHaveBeenCalled();
    expect(revokeFeedToken).not.toHaveBeenCalled();
  });

  it("lets a staff member open only their own feed, never the shop's", async () => {
    asRole("staff");
    vi.mocked(feedPeople).mockResolvedValue([{ id: STAFF, name: "Julie" }]);
    expect((await send(POST, "POST", {})).status).toBe(404);
    expect((await send(POST, "POST", { staffId: STAFF })).status).toBe(200);
    expect(await (await GET(new Request("http://localhost/api/walker/feeds"))).json()).toMatchObject({ shop: null });
  });

  it("revokes, and records it only when there was something to revoke", async () => {
    expect(await (await send(DELETE, "DELETE", {})).json()).toEqual({ revoked: true });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "shop.feed_revoked" }));
    vi.mocked(audit).mockClear();
    vi.mocked(revokeFeedToken).mockResolvedValue(false);
    expect(await (await send(DELETE, "DELETE", {})).json()).toEqual({ revoked: false });
    expect(audit).not.toHaveBeenCalled();
  });

  it("is a 403 when the administrator switched the feeds off, and offers none", async () => {
    vi.mocked(appSettings).mockReturnValue({ get: vi.fn(async () => false) } as never);
    expect((await send(POST, "POST", {})).status).toBe(403);
    expect(await (await GET(new Request("http://localhost/api/walker/feeds"))).json()).toMatchObject({ enabled: false });
  });

  it("answers the guard's refusal (another shop's id, no session)", async () => {
    vi.mocked(requireShop).mockRejectedValue(refuse(404, "NOT_FOUND", "Not found"));
    expect((await GET(new Request("http://localhost/api/walker/feeds?shopId=other"))).status).toBe(404);
    expect((await send(POST, "POST", {})).status).toBe(404);
  });
});
