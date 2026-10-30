// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShopVideoLazy } from "./ShopVideoLazy";

vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="tv" /> }));
vi.mock("@krizaka/ui/page", () => ({ Section: ({ children, title }: { children: ReactNode; title: ReactNode }) => <section><h2>{title}</h2>{children}</section> }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let callback: ((e: { isIntersecting: boolean }[]) => void) | null = null;
const disconnect = vi.fn();
class FakeObserver {
  constructor(cb: typeof callback) { callback = cb; }
  observe = vi.fn();
  disconnect = disconnect;
}
afterEach(() => { callback = null; disconnect.mockClear(); });

const props = { title: "Videos", playlist: [{ id: "a", title: "A", poster: "https://cdn.example/p.jpg" }] } as unknown as Parameters<typeof ShopVideoLazy>[0];

describe("ShopVideoLazy: the television is downloaded when it nears the screen (client JS budget, no layout shift)", () => {
  it("holds the heading and the poster frame until the frame is near, then mounts the set once", async () => {
    globalThis.IntersectionObserver = FakeObserver as never;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<ShopVideoLazy {...props} />));
    expect(host.querySelector("h2")?.textContent).toBe("Videos");
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
