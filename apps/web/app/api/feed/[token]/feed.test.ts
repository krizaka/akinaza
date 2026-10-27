import { feedByTokenHash, feedEntriesAround } from "@akinaza/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sessionSecret } from "@/lib/env";
import { feedTokenHash, newFeedToken } from "@/lib/feed-token";
import { resetRateLimits } from "@/lib/rate-limit";
import { appSettings } from "@/lib/settings";

import { GET } from "./route";

vi.mock("@/lib/db", () => ({ db: vi.fn(() => ({})) }));
vi.mock("@/lib/settings", () => ({ appSettings: vi.fn() }));
vi.mock("@akinaza/db", async (original) => ({ ...(await original<typeof import("@akinaza/db")>()), feedByTokenHash: vi.fn(), feedEntriesAround: vi.fn(), feedTitle: vi.fn(async () => "Akinaza · Salon Laurier") }));

const call = (segment: string) => GET(new Request(`http://localhost/api/feed/${segment}`), { params: Promise.resolve({ token: segment }) });

describe("the private calendar feed (#282, ADR-004)", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.mocked(appSettings).mockReturnValue({ get: vi.fn(async () => true) } as never);
    vi.mocked(feedEntriesAround).mockResolvedValue([{ appointmentId: "a1", startsAt: new Date("2026-10-27T14:00:00Z"), endsAt: new Date("2026-10-27T14:45:00Z"), status: "booked", service: { fr: "Coupe", en: "Haircut" }, firstNames: ["Camille"] }]);
  });
  afterEach(() => vi.clearAllMocks());

  it("serves the calendar for a live token, never cached by a shared cache, never indexed", async () => {
    const token = newFeedToken();
    vi.mocked(feedByTokenHash).mockResolvedValue({ shopId: "s1", staffId: null });
    const res = await call(`${token}.ics`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(await res.text()).toContain("SUMMARY:Coupe · Camille");
    expect(feedByTokenHash).toHaveBeenCalledWith({}, feedTokenHash(token, sessionSecret()));
  });

  it("answers the same 404 for an unknown or revoked token, a malformed one, and a feed the administrator switched off", async () => {
    vi.mocked(feedByTokenHash).mockResolvedValue(null);
    const unknown = await call(`${newFeedToken()}.ics`);
    const malformed = await call("agenda.ics");
    vi.mocked(appSettings).mockReturnValue({ get: vi.fn(async () => false) } as never);
    vi.mocked(feedByTokenHash).mockResolvedValue({ shopId: "s1", staffId: null });
    const off = await call(`${newFeedToken()}.ics`);
    for (const res of [unknown, malformed, off]) {
      expect(res.status).toBe(404);
      expect(res.headers.get("content-type")).not.toContain("text/calendar");
    }
    expect(await unknown.text()).toBe(await malformed.text());
  });

  it("is rate-limited per address", async () => {
    vi.mocked(feedByTokenHash).mockResolvedValue(null);
    let last = 200;
    for (let i = 0; i < 130; i += 1) last = (await call(`${newFeedToken()}.ics`)).status;
    expect(last).toBe(429);
  });
});
