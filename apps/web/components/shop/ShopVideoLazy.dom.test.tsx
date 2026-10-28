// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShopVideoLazy } from "./ShopVideoLazy";

vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="tv" /> }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let callback: ((e: { isIntersecting: boolean }[]) => void) | null = null;
const disconnect = vi.fn();
class FakeObserver {
  constructor(cb: typeof callback) {
    callback = cb;
  }
  observe = vi.fn();
  disconnect = disconnect;
}
afterEach(() => {
  callback = null;
  disconnect.mockClear();
});

const props = { id: "tv", clip: { poster: "https://cdn.example/p.jpg" } } as unknown as Parameters<typeof ShopVideoLazy>[0];

describe("ShopVideoLazy: the television is downloaded when it nears the screen, not at hydration (client JS budget)", () => {
  it("holds the poster frame until the frame is near, then mounts the player once", async () => {
    globalThis.IntersectionObserver = FakeObserver as never;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<ShopVideoLazy {...props} />));
    expect(host.querySelector("[data-tv-frame]")).not.toBeNull();
    expect(host.querySelector("[data-testid=tv]")).toBeNull();
    await act(async () => callback?.([{ isIntersecting: false }]));
    expect(host.querySelector("[data-testid=tv]")).toBeNull();
    await act(async () => callback?.([{ isIntersecting: true }]));
    expect(host.querySelector("[data-testid=tv]")).not.toBeNull();
    expect(disconnect).toHaveBeenCalled();
    act(() => root.unmount());
    host.remove();
  });
});
