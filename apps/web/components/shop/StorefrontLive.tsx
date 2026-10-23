"use client";

import { eventSourceLive } from "@krizaka/query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** The server remains the authority; a public event only asks it to render again. */
export function StorefrontLive({ slug, enabled }: { slug: string; enabled: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const live = eventSourceLive(`/api/shops/${encodeURIComponent(slug)}/events`, {
      // Catch up after the initial render, a hidden tab or a dropped connection.
      onStatus: (status) => { if (status === "open") refresh(); },
    });
    let unsubscribe: (() => void) | undefined;
    const visibility = () => {
      if (document.visibilityState === "visible") {
        unsubscribe ??= live.subscribe("slots.changed", refresh);
      } else {
        unsubscribe?.();
        unsubscribe = undefined;
      }
    };
    document.addEventListener("visibilitychange", visibility);
    visibility();
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      unsubscribe?.();
    };
  }, [slug, enabled, router]);
  return null;
}
