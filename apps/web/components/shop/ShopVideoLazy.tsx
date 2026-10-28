"use client";

import type { VideoSection as VideoSectionType } from "@krizaka/ui/shop/video";
import dynamic from "next/dynamic";
import { type ComponentProps, useCallback, useState } from "react";

type VideoProps = ComponentProps<typeof VideoSectionType>;

const loadVideoSection = () => import("@krizaka/ui/shop/video").then((m) => m.VideoSection);
// The player decides its buttons from the browser (picture in picture, full screen): it is drawn in the browser only.
const Video = dynamic(loadVideoSection, { ssr: false });
/** The shorts variant keeps its server render (links to the platforms); its code is still a chunk of its own, never part of the page's. */
export const ShopReelsSection = dynamic(loadVideoSection);

/** The television starts loading when its frame enters the screen: the poster holds the same frame meanwhile, and nothing is fetched for a visitor who never scrolls there. */
const NEAR = "0px";

/**
 * The shop page's television (`@krizaka/ui` `RetroTv`), downloaded when its frame enters the screen (akinaza#404, #483). Its player and cabinet are the heaviest part of
 * the shop page and sit far below the first screen: nothing of them is fetched until the visitor scrolls close (the client JS budget of the page counts what it loads),
 * and a server render of the player differs from its first client render (React #418, caught by `check:hydration`). Until then the section keeps its own anchor and
 * key, with the poster's frame, so the outline of the composer and the page do not move.
 */
export function ShopVideoLazy(props: Readonly<VideoProps>) {
  const [near, setNear] = useState(false);
  // Observing the frame is a subscription to the browser, not data: no effect, a ref callback that disconnects once it has answered.
  const watch = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return setNear(true);
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      setNear(true);
      io.disconnect();
    }, { rootMargin: NEAR });
    io.observe(el);
  }, []);
  if (near) return <Video {...props} />;
  const poster = props.clip?.poster;
  return (
    <section ref={watch} id={props.id} data-shop-key={(props as Record<string, unknown>)["data-shop-key"] as string | undefined} aria-hidden="true" data-tv-frame="" className="mx-auto w-full max-w-(--kz-page-max,72rem) px-(--kz-page-gutter,1rem) py-8">
      <div className="aspect-[4/5] max-h-[36rem] w-full max-w-80 overflow-hidden border border-border-default bg-surface-2">
        {poster ? <div role="presentation" className="h-full w-full bg-cover bg-center opacity-70" style={{ backgroundImage: `url(${poster})` }} /> : null}
      </div>
    </section>
  );
}
