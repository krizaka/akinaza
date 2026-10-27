import { addConnection, connectionSecret, feedPeople, listConnections, recordSyncOk, removeConnection, sealField } from "@akinaza/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireShop } from "@/lib/access";
import { audit } from "@/lib/audit";
import { appSettings } from "@/lib/settings";

import { DELETE, GET, POST } from "./route";

vi.mock("@/lib/access", async (original) => ({ ...(await original<typeof import("@/lib/access")>()), requireShop: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: vi.fn(() => ({})) }));
vi.mock("@/lib/env", () => ({ dataKey: () => Buffer.alloc(32, 7), calendarOAuthApps: () => ({ google: { clientId: "cid", clientSecret: "csec" } }) }));
vi.mock("@/lib/settings", () => ({ appSettings: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ limit: vi.fn() }));
vi.mock("@akinaza/db", async (original) => ({ ...(await original<typeof import("@akinaza/db")>()), addConnection: vi.fn(), connectionSecret: vi.fn(), feedPeople: vi.fn(), listConnections: vi.fn(), recordSyncOk: vi.fn(), removeConnection: vi.fn() }));
vi.mock("@/lib/calendar/public-url", async (original) => ({ ...(await original<typeof import("@/lib/calendar/public-url")>()), assertPublicHost: vi.fn(async () => undefined) }));

const STAFF = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ICS = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:a\r\nDTSTART:20991027T140000Z\r\nDTEND:20991027T150000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
const send = (route: (req: Request) => Promise<Response>, method: string, json: unknown) => route(new Request("http://localhost/api/walker/calendars", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(json) }));
const asRole = (role: "owner" | "manager" | "staff") => vi.mocked(requireShop).mockResolvedValue({ role, shop: { id: "s1", timezone: "America/Toronto" }, session: { account: { id: "acc", email: "o@example.com" } } } as never);
const good = { kind: "ics", url: "webcal://calendar.example.com/secret-token/me.ics", label: "Google", staffId: null, consent: true };

describe("connecting a calendar (#282, ADR-004)", () => {
  beforeEach(() => {
    asRole("owner");
    vi.mocked(appSettings).mockReturnValue({ get: vi.fn(async (key: string) => (key === "calendarSync.maxCalendarsPerShop" ? 5 : key.startsWith("calendarSync.intervalMinutes") ? 30 : key.startsWith("calendarSync.windowDays") ? 60 : !/google|outlook|caldav/.test(key))) } as never);
    vi.mocked(feedPeople).mockResolvedValue([{ id: STAFF, name: "Julie" }]);
    vi.mocked(listConnections).mockResolvedValue([{ id: "c1", staffId: null, kind: "ics", label: "Google", state: "ok", lastError: null, lastSuccessAt: new Date("2026-10-26T12:00:00Z"), consentedAt: new Date("2026-10-26T11:00:00Z") }]);
    vi.mocked(addConnection).mockResolvedValue({ id: "c2" } as never);
    vi.mocked(removeConnection).mockResolvedValue(true);
    vi.mocked(connectionSecret).mockResolvedValue(null);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(ICS)));
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("lists the calendars and the kinds on, never an address", async () => {
    const json = await (await GET(new Request("http://localhost/api/walker/calendars"))).json();
    expect(json).toMatchObject({ enabled: true, kinds: ["ics"], wholeShop: true, connections: [{ id: "c1", state: "ok" }] });
    expect(JSON.stringify(json)).not.toMatch(/secret-token|secretEnc|calendar\.example/);
  });

  it("reads the address once, seals it, records the consent and audits, without the address", async () => {
    const res = await send(POST, "POST", good);
    expect(res.status).toBe(201);
    const added = vi.mocked(addConnection).mock.calls[0]![1];
    expect(added.secretEnc).toMatch(/^v1\./);
    expect(added.secretEnc).not.toContain("secret-token");
    expect(added).toMatchObject({ shopId: "s1", staffId: null, kind: "ics", consentTextVersion: "2026-10-26", max: 5 });
    expect(recordSyncOk).toHaveBeenCalled();
    const line = vi.mocked(audit).mock.calls[0]![0];
    expect(line).toMatchObject({ action: "shop.calendar_connected", targetId: "s1" });
    expect(JSON.stringify(line)).not.toContain("secret-token");
  });

  it("keeps nothing when the address cannot be read, and says why", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 404 })));
    const res = await send(POST, "POST", good);
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("CAL_REFUSED");
    expect((await send(POST, "POST", { ...good, url: "http://127.0.0.1/x.ics" })).status).toBe(400);
    expect(addConnection).not.toHaveBeenCalled();
  });

  it("needs the consent, and the feature on", async () => {
    expect((await send(POST, "POST", { ...good, consent: false })).status).toBe(400);
    vi.mocked(appSettings).mockReturnValue({ get: vi.fn(async () => false) } as never);
    expect((await send(POST, "POST", good)).status).toBe(403);
    expect(addConnection).not.toHaveBeenCalled();
  });

  it("lets a staff member connect only their own agenda; another shop's staff id is a 404", async () => {
    asRole("staff");
    expect((await send(POST, "POST", good)).status).toBe(404); // the whole shop's agenda is not theirs
    expect((await send(POST, "POST", { ...good, staffId: OTHER })).status).toBe(404);
    expect((await send(POST, "POST", { ...good, staffId: STAFF })).status).toBe(201);
  });

  it("disconnects a calendar of the shop, and a stranger's id is a 404", async () => {
    expect((await send(DELETE, "DELETE", { id: "33333333-3333-4333-8333-333333333333" })).status).toBe(404);
    expect(removeConnection).not.toHaveBeenCalled();
    vi.mocked(listConnections).mockResolvedValue([{ id: "33333333-3333-4333-8333-333333333333", staffId: null, kind: "ics", label: "G", state: "ok", lastError: null, lastSuccessAt: null, consentedAt: new Date() }]);
    expect((await send(DELETE, "DELETE", { id: "33333333-3333-4333-8333-333333333333" })).status).toBe(200);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "shop.calendar_removed" }));
  });

  it("tells Google to forget the grant when a Google calendar is disconnected, then deletes it even if Google is down", async () => {
    const id = "44444444-4444-4444-8444-444444444444";
    vi.mocked(listConnections).mockResolvedValue([{ id, staffId: null, kind: "google", label: "G", state: "ok", lastError: null, lastSuccessAt: null, consentedAt: new Date() }]);
    vi.mocked(connectionSecret).mockResolvedValue({ kind: "google", secretEnc: sealField("REFRESH", Buffer.alloc(32, 7), id) });
    const down = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit): Promise<Response> => Promise.reject(new Error("google is down")));
    vi.stubGlobal("fetch", down);
    expect((await send(DELETE, "DELETE", { id })).status).toBe(200);
    expect(String(down.mock.calls[0]![0])).toBe("https://oauth2.googleapis.com/revoke");
    expect(new URLSearchParams(String((down.mock.calls[0]![1] as RequestInit).body)).get("token")).toBe("REFRESH");
    expect(removeConnection).toHaveBeenCalledWith(expect.anything(), "s1", id);
  });

  it("connects a CalDAV calendar: read once over HTTPS, the whole credential sealed together, never shown", async () => {
    const xml = `<d:multistatus xmlns:d="DAV:"><c:calendar-data xmlns:c="urn:ietf:params:xml:ns:caldav">${ICS}</c:calendar-data></d:multistatus>`;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(xml, { status: 207 })));
    vi.mocked(appSettings).mockReturnValue({ get: vi.fn(async (key: string) => (key === "calendarSync.maxCalendarsPerShop" ? 5 : key.endsWith("intervalMinutes") ? 30 : key.endsWith("windowDays") ? 60 : true)) } as never);
    const res = await send(POST, "POST", { kind: "caldav", url: "https://caldav.example.com/me/", username: "me", password: "app-pw", label: "iCloud", staffId: null, consent: true });
    expect(res.status).toBe(201);
    const added = vi.mocked(addConnection).mock.calls[0]![1];
    expect(added).toMatchObject({ kind: "caldav" });
    expect(added.secretEnc).not.toContain("app-pw");
    expect(JSON.stringify(vi.mocked(audit).mock.calls)).not.toContain("app-pw");
  });
});
