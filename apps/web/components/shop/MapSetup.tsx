"use client";

// The basemap through this origin (/maps/v1, the media CDN proxied by next.config): no cross-origin request.
// The engine's worker comes from this origin too (app/maplibre): the page's CSP allows no third-party script.
// Set once the map module has loaded, in its own chunk and off the hero's critical path (akinaza#459: the basemap styles were in the first script); the `visit` map is a lazy gate far below the fold and reads this configuration when it mounts.
if (typeof window !== "undefined") void import("@krizaka/ui/map").then(({ configureMaps }) => configureMaps({ assetsBase: `${window.location.origin}/maps/v1`, workerUrl: "/maplibre/maplibre-gl-worker.mjs" }));

/** Renders nothing: it only puts the page's maps on this origin (the page's CSP forbids the CDN and third-party workers). */
export function MapSetup() {
  return null;
}
