import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StorefrontLive } from "./StorefrontLive";

const hooks = vi.hoisted(() => ({ refresh: vi.fn(), effect: null as null | (() => void | (() => void)) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: hooks.refresh }) }));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useEffect: (effect: () => void | (() => void)) => { hooks.effect = effect; } }));

class Source extends EventTarget {
  static instances: Source[] = [];
  readyState = 1;
  close = vi.fn();
  constructor(readonly url: string) {
    super();
    Source.instances.push(this);
  }
}

describe("storefront live refresh", () => {
  let document: EventTarget & { visibilityState: string };
  let cleanup: void | (() => void);
  const visibility = (state: string) => {
    document.visibilityState = state;
    document.dispatchEvent(new Event("visibilitychange"));
  };
  const mount = (enabled = true) => {
    StorefrontLive({ slug: "atelier", enabled });
    cleanup = hooks.effect!();
  };

  beforeEach(() => {
    document = Object.assign(new EventTarget(), { visibilityState: "visible" });
    vi.stubGlobal("document", document);
    vi.stubGlobal("EventSource", Source);
    Source.instances = [];
    hooks.refresh.mockClear();
  });
  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    vi.unstubAllGlobals();
  });

  it("refreshes on slot changes and on connection, without rendering any UI", () => {
    expect(StorefrontLive({ slug: "atelier", enabled: true })).toBeNull();
    cleanup = hooks.effect!();
    const source = Source.instances[0]!;
    expect(source.url).toBe("/api/shops/atelier/events");
    source.dispatchEvent(new Event("open"));
    expect(hooks.refresh).toHaveBeenCalledTimes(1);
    source.dispatchEvent(new MessageEvent("slots.changed", { data: '{"type":"slots.changed"}' }));
    expect(hooks.refresh).toHaveBeenCalledTimes(2);
  });

  it("disconnects while hidden, reconnects on return and cleans up on unmount", () => {
    mount();
    const first = Source.instances[0]!;
    visibility("hidden");
    expect(first.close).toHaveBeenCalledOnce();
    first.dispatchEvent(new MessageEvent("slots.changed", { data: "{}" }));
    expect(hooks.refresh).not.toHaveBeenCalled();
    visibility("visible");
    expect(Source.instances).toHaveLength(2);
    Source.instances[1]!.dispatchEvent(new Event("open"));
    expect(hooks.refresh).toHaveBeenCalledOnce();
    cleanup?.();
    cleanup = undefined;
    expect(Source.instances[1]!.close).toHaveBeenCalledOnce();
    visibility("visible");
    expect(Source.instances).toHaveLength(2);
  });

  it("opens nothing when disabled or initially hidden", () => {
    mount(false);
    expect(Source.instances).toHaveLength(0);
    cleanup?.();
    visibility("hidden");
    mount();
    expect(Source.instances).toHaveLength(0);
    visibility("visible");
    expect(Source.instances).toHaveLength(1);
  });
});
