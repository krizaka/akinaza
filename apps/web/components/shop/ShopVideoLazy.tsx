"use client";

import { VideoSection } from "@krizaka/ui/shop/video";
import { type ComponentProps, useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

/**
 * The shop page's video section, drawn once the page is alive (akinaza#404). The television's player decides its buttons from the browser (picture in picture, full
 * screen), so a server render of it differs from the first client render (React #418, caught by `check:hydration` on the journal look); the old television was lazy for
 * the same reason (`ShopTvLazy`). Until then the section keeps its own anchor and key, with the poster's frame, so the outline of the composer and the page do not move.
 */
export function ShopVideoLazy(props: Readonly<ComponentProps<typeof VideoSection>>) {
  // False for the server and the hydration pass, true right after.
  const ready = useSyncExternalStore(subscribeNever, () => true, () => false);
  if (ready) return <VideoSection {...props} />;
  const poster = props.clip?.poster;
  return (
    <section id={props.id} data-shop-key={(props as Record<string, unknown>)["data-shop-key"] as string | undefined} aria-hidden="true" data-tv-frame="" className="mx-auto w-full max-w-(--kz-page-max,72rem) px-(--kz-page-gutter,1rem) py-8">
      <div className="aspect-[4/5] max-h-[36rem] w-full max-w-80 overflow-hidden border border-border-default bg-surface-2">
        {poster ? <div role="presentation" className="h-full w-full bg-cover bg-center opacity-70" style={{ backgroundImage: `url(${poster})` }} /> : null}
      </div>
    </section>
  );
}
