import { addConnection, recordSyncOk } from "@akinaza/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { newPkce, pkceCookie, signState } from "@/lib/calendar/oauth-state";
import { appSettings } from "@/lib/settings";

import { GET as callback } from "./callback/[kind]/route";
import { POST as connect } from "./connect/[kind]/route";

vi.mock("@/lib/access", async (original) => ({ ...(await original<typeof import("@/lib/access")>()), requireShop: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: vi.fn(() => ({})) }));
vi.mock("@/lib/env", () => ({
  dataKey: () => Buffer.alloc(32, 7),
  sessionSecret: () => "session-secret",
  env: () => ({ APP_PUBLIC_URL: "https://www.akinaza.com" }),
  calendarOAuthApps: () => ({ google: { clientId: "cid", clientSecret: "csec" } }),
}));
vi.mock("@/lib/settings", () => ({ appSettings: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ limit: vi.fn() }));
vi.mock("@/lib/calendar/overview", async (original) => ({
  ...(await original<typeof import("@/lib/calendar/overview")>()),
  calendarOverview: vi.fn(async () => ({ wholeShop: true, people: [{ id: "11111111-1111-4111-8111-111111111111", name: "Julie" }], connections: [], enabled: true, kinds: [] })),
}));
vi.mock("@akinaza/db", async (original) => ({ ...(await original<typeof import("@akinaza/db")>()), addConnection: vi.fn(), recordSyncOk: vi.fn() }));

const params = (kind: string) => ({ params: Promise.resolve({ kind }) });
const flags = (over: Record<string, unknown> = {}) =>
  vi.mocked(appSettings).mockReturnValue({ get: vi.fn(async (key: string) => (key in over ? over[key] : key === "calendarSync.maxCalendarsPerShop" ? 5 : key.endsWith("intervalMinutes") ? 30 : key.endsWith("windowDays") ? 60 : true)) } as never);
const asOwner = () => vi.mocked(requireShop).mockResolvedValue({ role: "owner", shop: { id: "s1", timezone: "America/Toronto" }, session: { account: { id: "acc", email: "o@example.com" } } } as never);
const post = (kind: string, json: unknown) => connect(new Request(`http://localhost/api/calendars/connect/${kind}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(json) }), params(kind));
const ask = { label: "Mine", staffId: null, locale: "fr", consent: true };

describe("connecting Google or Outlook (#282, ADR-004)", () => {
  beforeEach(() => {
    asOwner();
    flags();
  });
  afterEach(() => vi.clearAllMocks());

  it("answers the provider's address with state and PKCE challenge, and keeps the verifier in an HttpOnly cookie only", async () => {
    const res = await post("google", ask);
    expect(res.status).toBe(200);
    const { url } = (await res.json()) as { url: string };
    const q = new URL(url).searchParams;
    expect(q.get("scope")).toBe("https://www.googleapis.com/auth/calendar.freebusy");
    expect(q.get("redirect_uri")).toBe("https://www.akinaza.com/api/calendars/callback/google");
    expect(q.get("code_challenge_method")).toBe("S256");
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/HttpOnly/);
    const verifier = cookie.split(";")[0]!.split("=")[1]!.split(".")[1]!;
    expect(url).not.toContain(verifier);
  });

  it("is a 404 for a kind that is not an OAuth provider, and 403 while the flag is off or the client is missing", async () => {
    expect((await post("ics", ask)).status).toBe(404);
    flags({ "calendarSync.google.enabled": false });
    expect((await post("google", ask)).status).toBe(403);
    flags();
    expect((await post("outlook", ask)).status).toBe(403);
  });

  it("needs the consent ticked", async () => {
    expect((await post("google", { ...ask, consent: false })).status).toBe(400);
  });

  it("refuses a team member who is not the shop's", async () => {
    expect((await post("google", { ...ask, staffId: "22222222-2222-4222-8222-222222222222" })).status).toBe(404);
  });
});

describe("the callback", () => {
  const NOW = new Date();
  const verifier = newPkce().verifier;
  const stateOf = (over: Partial<Parameters<typeof signState>[0]> = {}) => signState({ kind: "google", shopId: "s1", staffId: null, accountId: "acc", label: "Mine", locale: "fr", ...over }, "session-secret", NOW);
  const hit = (kind: string, state: string, nonce: string, extra = "code=abc", cookie: string | null = pkceCookie(nonce, verifier, true).split(";")[0]!) =>
    callback(new Request(`https://www.akinaza.com/api/calendars/callback/${kind}?state=${encodeURIComponent(state)}&${extra}`, { headers: cookie ? { cookie } : {} }), params(kind));
  const answers = () =>
    vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("oauth2.googleapis.com/token")) return new URLSearchParams(String(init?.body)).get("grant_type") === "authorization_code" ? Response.json({ access_token: "a", refresh_token: "REFRESH" }) : Response.json({ access_token: "a" });
      return Response.json({ calendars: { primary: { busy: [{ start: "2099-10-27T14:00:00Z", end: "2099-10-27T15:00:00Z" }] } } });
    });

  beforeEach(() => {
    asOwner();
    flags();
    vi.mocked(addConnection).mockResolvedValue({ id: "c1" } as never);
    vi.stubGlobal("fetch", answers());
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("exchanges the code with the verifier, seals the refresh token, records the consent, reads once and goes back to Agenda", async () => {
    const { state, nonce } = stateOf();
    const res = await hit("google", state, nonce);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/fr/app/s1/boutique/agenda?calendar=connected");
    const exchange = vi.mocked(fetch).mock.calls.find(([u]) => String(u).includes("token"))!;
    expect(new URLSearchParams(String((exchange[1] as RequestInit).body)).get("code_verifier")).toBe(verifier);
    const added = vi.mocked(addConnection).mock.calls[0]![1];
    expect(added).toMatchObject({ shopId: "s1", staffId: null, kind: "google", label: "Mine", consentTextVersion: "2026-10-26" });
    expect(added.secretEnc).toMatch(/^v1\./);
    expect(added.secretEnc).not.toContain("REFRESH");
    expect(recordSyncOk).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(audit).mock.calls)).not.toContain("REFRESH");
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("keeps the connection even when the first read fails: the tick tries again", async () => {
    const { state, nonce } = stateOf();
    const base = answers();
    vi.stubGlobal("fetch", vi.fn(async (u: RequestInfo | URL, i?: RequestInit) => (String(u).includes("freeBusy") ? Response.json({}, { status: 503 }) : base(u, i))));
    expect((await hit("google", state, nonce)).headers.get("location")).toContain("connected");
    expect(recordSyncOk).not.toHaveBeenCalled();
  });

  it("keeps nothing for a forged or stale state, a missing or foreign PKCE cookie, another account, or a wrong kind", async () => {
    const good = stateOf();
    expect((await hit("google", `${good.state}x`, good.nonce)).status).toBe(404);
    expect((await hit("outlook", good.state, good.nonce)).status).toBe(404);
    expect((await hit("google", good.state, good.nonce, "code=abc", null)).headers.get("location")).toContain("error");
    expect((await hit("google", good.state, "other-nonce")).headers.get("location")).toContain("error");
    const other = stateOf({ accountId: "someone-else" });
    expect((await hit("google", other.state, other.nonce)).headers.get("location")).toContain("error");
    expect(addConnection).not.toHaveBeenCalled();
  });

  it("says denied when the owner refused the permission, and error for anything else the provider reports", async () => {
    const { state, nonce } = stateOf();
    expect((await hit("google", state, nonce, "error=access_denied")).headers.get("location")).toContain("calendar=denied");
    expect((await hit("google", state, nonce, "error=server_error")).headers.get("location")).toContain("calendar=error");
    expect(addConnection).not.toHaveBeenCalled();
  });

  it("goes back with an error, showing no code, when the provider refuses the exchange", async () => {
    const { state, nonce } = stateOf();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "invalid_grant" }, { status: 400 })));
    const res = await hit("google", state, nonce);
    expect(res.headers.get("location")).toBe("/fr/app/s1/boutique/agenda?calendar=error");
    expect(addConnection).not.toHaveBeenCalled();
  });
});
