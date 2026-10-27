"use client";

import { configureMaps } from "@krizaka/ui/map";

// The basemap through this origin (/maps/v1, the media CDN proxied by next.config): no cross-origin request.
// The engine's worker comes from this origin too (app/maplibre): the page's CSP allows no third-party script.
// Set when this module loads, before any map of the page mounts (the shop page's `visit` map is a `@krizaka/ui/shop` gate that reads this configuration).
if (typeof window !== "undefined") configureMaps({ assetsBase: `${window.location.origin}/maps/v1`, workerUrl: "/maplibre/maplibre-gl-worker.mjs" });

/** Renders nothing: it only puts the page's maps on this origin (the page's CSP forbids the CDN and third-party workers). */
export function MapSetup() {
  return null;
}
