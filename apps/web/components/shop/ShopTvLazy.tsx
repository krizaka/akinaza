"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { type ComponentProps, useSyncExternalStore } from "react";

import type { ShopTv } from "./CommunityWall";

type TvProps = ComponentProps<typeof ShopTv>;

const Tv = dynamic(() => import("./CommunityWall").then((m) => m.ShopTv), { ssr: false });

const subscribeNever = () => () => {};

/**
 * The television, after the page has hydrated (B45). Its player and cabinet are the heaviest part of the shop page, and a page whose
 * hydration runs late meets the motion observer's marks on its markup (React #418, caught by `check:hydration`). Until the player is
 * there, the poster holds the same 4:5 frame, so nothing moves when it arrives.
 */
export function ShopTvLazy(props: Readonly<TvProps>) {
  // False for the server and for the hydration pass, true right after: the player is mounted once the page is alive.
  const ready = useSyncExternalStore(subscribeNever, () => true, () => false);
  if (ready) return <Tv {...props} />;
  return (
    <div aria-hidden="true" data-tv-frame="" className="relative aspect-[4/5] w-full overflow-hidden border border-border-default bg-surface-2">
      {props.video.poster ? <Image src={props.video.poster} alt="" fill unoptimized sizes="20rem" referrerPolicy="no-referrer" className="object-cover opacity-70" /> : null}
    </div>
  );
}
