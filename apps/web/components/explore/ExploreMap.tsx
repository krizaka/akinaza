"use client";

import type { RankedShop } from "@akinaza/core";
import { Map, Marker, UserPosition } from "@krizaka/ui/map";

import type { Origin } from "@/lib/explore";

import { MapSetup } from "../shop/MapSetup";

/**
 * The map of Explorer: a marker per shop that has a position, the visitor's origin when there is one. It is its own chunk (loaded
 * on demand by `ExploreView`), so the page's first paint carries no map engine. Tiles come through this origin (`MapSetup`).
 */
export default function ExploreMap({ shops, selected, onSelect, origin, center, zoom, onMoveEnd, locale, label, youLabel }: Readonly<{ shops: readonly RankedShop[]; selected: string | null; onSelect: (slug: string) => void; origin: Origin | null; center: readonly [number, number]; zoom: number | null; onMoveEnd: (center: readonly [number, number], zoom: number) => void; locale: string; label: string; youLabel: string }>) {
  const on = shops.find((s) => s.slug === selected);
  return (
    <>
      <MapSetup />
      <Map label={label} center={on?.point ?? center} zoom={on?.point ? 14 : (zoom ?? 12)} controlled onMoveEnd={(v) => onMoveEnd(v.center, v.zoom)} brand="akinaza" lang={locale} className="h-full min-h-80 w-full">
        {shops.flatMap((s) => (s.point ? [<Marker key={s.slug} position={s.point} label={s.name} selected={s.slug === selected} onPress={() => onSelect(s.slug)} />] : []))}
        {origin ? <UserPosition position={origin.point} label={origin.label ?? youLabel} /> : null}
      </Map>
    </>
  );
}
