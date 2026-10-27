import { type CalendarSource, CalendarSourceError } from "@akinaza/core";
import { type DueConnection, recordSyncFailure, recordSyncOk } from "@akinaza/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { audit } from "@/lib/audit";

import { syncConnection } from "./sync";

vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: vi.fn(() => ({})) }));
vi.mock("@/lib/settings", () => ({ appSettings: vi.fn() }));
vi.mock("@akinaza/db", async (original) => ({ ...(await original<typeof import("@akinaza/db")>()), openField: vi.fn(() => "https://calendar.example.com/me.ics"), recordSyncOk: vi.fn(), recordSyncFailure: vi.fn(), claimDueConnections: vi.fn() }));

const KEY = Buffer.alloc(32, 1);
const NOW = new Date("2026-10-26T12:00:00Z");
const settings = { intervalMinutes: 30, windowDays: 60 };
const conn = (over: Partial<DueConnection> = {}): DueConnection => ({ id: "c1", shopId: "s1", staffId: null, kind: "ics", secretEnc: "v1.x", validators: { etag: '"v1"', lastModified: null }, failures: 0, timezone: "America/Toronto", stale: false, ...over });
const source = (busy: CalendarSource["busy"]): CalendarSource => ({ kind: "ics", busy });

describe("syncing a connected calendar (ADR-004)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("records the busy times and the validators of a good read", async () => {
    const busy = vi.fn<CalendarSource["busy"]>(async () => ({ changed: true as const, busy: [{ startsAt: NOW, endsAt: new Date("2026-10-26T13:00:00Z") }], validators: { etag: '"v2"', lastModified: null } }));
    expect(await syncConnection(conn(), NOW, settings, KEY, () => source(busy))).toBe("ok");
    expect(busy.mock.calls[0]![1]).toEqual({ etag: '"v1"', lastModified: null }); // recent: the validators are sent
    expect(recordSyncOk).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ validators: { etag: '"v2"', lastModified: null } }), NOW, 30);
  });

  it("keeps the busy times when nothing changed", async () => {
    expect(await syncConnection(conn(), NOW, settings, KEY, () => source(async () => ({ changed: false })))).toBe("unchanged");
    expect(recordSyncOk).toHaveBeenCalledWith(expect.anything(), expect.anything(), null, NOW, 30);
  });

  it("reads the whole file again when the last good read is old, whatever the validators say", async () => {
    const busy = vi.fn<CalendarSource["busy"]>(async () => ({ changed: false as const }));
    await syncConnection(conn({ stale: true }), NOW, settings, KEY, () => source(busy));
    expect(busy.mock.calls[0]![1]).toEqual({ etag: null, lastModified: null });
  });

  it("turns a failure into a backoff and one audit line, not one per retry", async () => {
    const fail = source(async () => {
      throw new CalendarSourceError("AK_CAL_REFUSED", false);
    });
    expect(await syncConnection(conn(), NOW, settings, KEY, () => fail)).toBe("error");
    expect(recordSyncFailure).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: "c1" }), "AK_CAL_REFUSED", NOW, 30);
    expect(audit).toHaveBeenCalledTimes(1);
    await syncConnection(conn({ failures: 1 }), NOW, settings, KEY, () => fail);
    expect(audit).toHaveBeenCalledTimes(1);
  });

  it("a kind with no adapter or a switched-off kind is an error of the connection, never a crash", async () => {
    expect(await syncConnection(conn({ kind: "google" }), NOW, settings, KEY, () => null)).toBe("error");
    expect(recordSyncFailure).toHaveBeenCalledWith(expect.anything(), expect.anything(), "AK_CAL_REFUSED", NOW, 30);
  });
});
