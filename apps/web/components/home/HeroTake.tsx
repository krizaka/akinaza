"use client";

import { useEffect, useRef } from "react";

/**
 * The hero phone's take: a muted loop of the real journey. The poster is the first thing painted (the page's LCP, preloaded);
 * the video plays only while it is on screen and never under reduced motion or Save-Data — then the poster stays. No sound,
 * no controls, nothing to read in it that the page does not also say (the figcaption and the steps below).
 */
export function HeroTake({ poster, webm, mp4, alt, width, height }: Readonly<{ poster: string; webm: string; mp4: string; alt: string; width: number; height: number }>) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches || (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (calm) return;
    const watch = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void video.play().catch(() => {});
      else video.pause();
    });
    watch.observe(video);
    return () => watch.disconnect();
  }, []);
  return (
    <video ref={ref} className="block h-auto w-full" width={width} height={height} poster={poster} muted loop playsInline preload="none" aria-label={alt} data-hero-take="">
      <source src={webm} type="video/webm" />
      <source src={mp4} type="video/mp4" />
    </video>
  );
}
