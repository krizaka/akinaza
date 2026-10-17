"use client";

import { configureMaps, Map, Marker, StaticMap } from "@krizaka/ui/map";

import type { Locale } from "@/lib/i18n";
import type { StorefrontView } from "@/lib/storefront";

// The basemap through this origin (/maps/v1, the media CDN proxied by next.config): no cross-origin request.
// The engine's worker comes from this origin too (app/maplibre): the page's CSP allows no third-party script.
if (typeof window !== "undefined") configureMaps({ assetsBase: `${window.location.origin}/maps/v1`, workerUrl: "/maplibre/maplibre-gl-worker.mjs" });

/** The areas a shop serves, on a map in the Akinaza brand — a still map until the engine loads (and for good without WebGL). */
export function ZoneMap({ map, label, locale }: { map: NonNullable<StorefrontView["map"]>; label: string; locale: Locale }) {
  const places = map.places.map((p) => ({ position: p.position, label: p.name }));
  return (
    <Map
      label={label}
      center={map.center}
      zoom={map.zoom}
      brand="akinaza"
      lang={locale}
      className="h-72 overflow-hidden rounded-xl border border-border-default sm:h-96"
      fallback={<StaticMap label={label} center={map.center} zoom={map.zoom} places={places} className="h-full w-full" />}
    >
      {map.places.map((p) => (
        <Marker key={p.id} position={p.position} label={p.name} />
      ))}
    </Map>
  );
}
