"use client";

import { Section } from "@krizaka/ui/page";
import dynamic from "next/dynamic";
import { type ComponentProps, useCallback, useState } from "react";

import type { ShopVideoTv } from "@/components/shop/ShopVideoTv";

type TvProps = ComponentProps<typeof ShopVideoTv>;

const Tv = dynamic(() => import("@/components/shop/ShopVideoTv").then((m) => m.ShopVideoTv), { ssr: false });

/** How far below the screen the television starts loading, so it is there before it is scrolled to. */
const NEAR = "600px 0px";

/**
 * The shop page's television, loaded when it nears the screen (akinaza#404, #469). Its player and cabinet are the heaviest part of the page and sit far below the
 * first screen: nothing of them is downloaded before the visitor scrolls close (the client JS budget counts what the page loads), and the player decides its
 * buttons from the browser, so a server render of it would differ from the first client render (React #418, `check:hydration`). Until then the section keeps
 * its anchor, its key and its heading, with the first poster in a box of the television's own shape: nothing moves when the set arrives.
 */
export function ShopVideoLazy(props: Readonly<TvProps>) {
  const [near, setNear] = useState(false);
  // Observing the element is a subscription to the browser, not data: no effect, a ref callback that disconnects once it has answered.
  const watch = useCallback((el: HTMLDivElement | null) => {
    if (!el) {
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      return setNear(true);
    }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) {
        return;
      }
      setNear(true);
      io.disconnect();
    }, { rootMargin: NEAR });
    io.observe(el);
  }, []);
  if (near) {
    return <Tv {...props} />;
  }
  const poster = props.playlist[0]?.poster;
  return (
    <Section id={props.id} title={props.title} lead={props.lead} data-shop-key={props["data-shop-key"]} data-variant="tv">
      <div ref={watch} aria-hidden="true" data-tv-frame="" className="mx-auto aspect-[4/5] max-h-[36rem] w-full max-w-4xl overflow-hidden border border-border-default bg-surface-2 sm:aspect-[16/10] sm:max-h-none">
        {poster ? <div role="presentation" className="h-full w-full bg-cover bg-center opacity-70" style={{ backgroundImage: `url(${poster})` }} /> : null}
      </div>
    </Section>
  );
}
