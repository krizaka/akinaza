"use client";

import { type ReactNode, useEffect, useRef } from "react";

/**
 * The slot the signed-in frame (`AppFrame` of @krizaka/ui: a shell of `min-h-dvh`, a rail of `md:h-dvh`) is drawn in. What stands above
 * the page in the flow (the development notice, `[data-top-chrome]`) takes room the frame does not know about: a whole screen under
 * it scrolls by the notice's height, on every page, even an empty one. The slot reads that height (it wraps on a phone, so it is not
 * a constant) into `--kz-top-chrome-h`, and `globals.css` takes it off the frame's screen (`[data-app-frame-slot]`).
 */
export function FrameSlot({ children }: Readonly<{ children: ReactNode }>) {
  const slot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = slot.current;
    const chrome = document.querySelector<HTMLElement>("[data-top-chrome]");
    if (!node || !chrome) return;
    const apply = () => node.style.setProperty("--kz-top-chrome-h", `${chrome.offsetHeight}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(chrome);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={slot} data-app-frame-slot>
      {children}
    </div>
  );
}
