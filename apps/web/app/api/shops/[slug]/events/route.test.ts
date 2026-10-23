import { createBus, type RealtimeBus } from "@krizaka/realtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { realtimeBus, slotsTopic } from "@/lib/realtime";
import { appSettings } from "@/lib/settings";
import { loadPublicShop } from "@/lib/shop-page";

import { GET } from "./route";

vi.mock("@/lib/realtime", async (original) => ({ ...await original<typeof import("@/lib/realtime")>(), realtimeBus: vi.fn() }));
vi.mock("@/lib/settings", () => ({ appSettings: vi.fn() }));
vi.mock("@/lib/shop-page", () => ({ loadPublicShop: vi.fn() }));

describe("the public storefront stream", () => {
  let bus: RealtimeBus;
  let enabled: boolean;
  const streams: Response[] = [];
  const connect = async (slug = "atelier", signal?: AbortSignal) => {
    const response = await GET(new Request(`http://localhost/api/shops/${slug}/events`, { signal }), { params: Promise.resolve({ slug }) });
    if (response.ok && response.body) streams.push(response);
    return response;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    enabled = true;
    bus = createBus({ kind: "memory" });
    vi.mocked(realtimeBus).mockReturnValue(bus);
    vi.mocked(loadPublicShop).mockImplementation(async (slug) => slug === "missing" ? null : { shop: { id: slug } } as never);
    vi.mocked(appSettings).mockReturnValue({
      get: vi.fn(async (key: string) => key.endsWith(".enabled") ? enabled : key.endsWith(".heartbeatSeconds") ? 15 : 1),
    } as never);
  });

  afterEach(async () => {
    for (const response of streams.splice(0)) await response.body?.cancel();
    await bus.close();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("follows only this shop's slots and emits a constant, non-personal invalidation", async () => {
    const response = await connect();
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-accel-buffering")).toBe("no");
    const reader = response.body!.getReader();
    await reader.read(); // retry instruction
    await bus.publish(slotsTopic("other"), { client: "Other person" });
    await bus.publish(slotsTopic("atelier"), { client: "Private client", service: "Private service", reason: "Private reason", slotId: "private-id" });
    expect(new TextDecoder().decode((await reader.read()).value)).toBe('event: slots.changed\ndata: {"type":"slots.changed"}\n\n');
    reader.releaseLock();
  });

  it("answers 404 when disabled or when the shop is not public, without opening the bus", async () => {
    enabled = false;
    expect((await connect()).status).toBe(404);
    enabled = true;
    expect((await connect("missing")).status).toBe(404);
    expect(realtimeBus).not.toHaveBeenCalled();
  });

  it("bounds concurrent streams per shop and releases capacity on cancel and request abort", async () => {
    const controller = new AbortController();
    const first = await connect("atelier", controller.signal);
    expect((await connect()).status).toBe(429);
    const other = await connect("other");
    await other.body!.cancel();
    controller.abort();
    await Promise.resolve();
    const next = await connect();
    expect(next.status).toBe(200);
    await next.body!.cancel();
    expect((await connect()).status).toBe(200);
    expect(first.status).toBe(200);
  });

  it("uses the configured heartbeat and ends idle streams so settings are reread on reconnect", async () => {
    const response = await connect();
    const reader = response.body!.getReader();
    await reader.read();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(new TextDecoder().decode((await reader.read()).value)).toBe(": heartbeat\n\n");
    await vi.advanceTimersByTimeAsync(285_000);
    while (!(await reader.read()).done) { /* drain heartbeats */ }
    reader.releaseLock();
    expect((await connect()).status).toBe(200);
  });

  it("does not reserve a stream for an already disconnected request", async () => {
    const controller = new AbortController();
    controller.abort();
    expect((await connect("atelier", controller.signal)).status).toBe(204);
    expect((await connect()).status).toBe(200);
  });
});
