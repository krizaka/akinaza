"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { type ComponentProps, useCallback, useState } from "react";

import type { ShopTv } from "./CommunityWall";

type TvProps = ComponentProps<typeof ShopTv>;

const Tv = dynamic(() => import("./CommunityWall").then((m) => m.ShopTv), { ssr: false });

/** How far below the screen the television starts loading, so it is there before it is scrolled to. */
const NEAR = "600px 0px";

/**
 * The television, when it nears the screen (B45, akinaza#483). Its player and cabinet are the heaviest part of the shop page, and they sit
 * far below the first screen: nothing of them is downloaded until the visitor scrolls close (the client JS budget of the page counts what
 * it loads), and a page whose hydration runs late never meets the motion observer's marks on its markup (React #418, `check:hydration`).
 * Until then the poster holds the same 4:5 frame, so nothing moves when it arrives.
 */
export function ShopTvLazy(props: Readonly<TvProps>) {
  const [near, setNear] = useState(false);
  // Observing the element is a subscription to the browser, not data: no effect, a ref callback that disconnects once it has answered.
  const watch = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return setNear(true);
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      setNear(true);
      io.disconnect();
    }, { rootMargin: NEAR });
    io.observe(el);
  }, []);
  if (near) return <Tv {...props} />;
  return (
    <div ref={watch} aria-hidden="true" data-tv-frame="" className="relative aspect-[4/5] w-full overflow-hidden border border-border-default bg-surface-2">
      {props.video.poster ? <Image src={props.video.poster} alt="" fill unoptimized sizes="20rem" referrerPolicy="no-referrer" className="object-cover opacity-70" /> : null}
    </div>
  );
}
