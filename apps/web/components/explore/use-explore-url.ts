"use client";

import { EXPLORE_KINDS, EXPLORE_OPEN, EXPLORE_RADII, type ExploreRadius, type ExploreUrlState } from "@akinaza/core";
import { parseAsArrayOf, parseAsFloat, parseAsString, parseAsStringLiteral, useQueryStates, withUrlDefaults } from "@krizaka/query/url";

const RADII = EXPLORE_RADII.map(String) as ["1", "3", "10", "25"];

/** Every filter and the camera in the address (`?q=&kind=salon,boutique&open=week&near=lng,lat&within=3&view=lng,lat,zoom`): shareable, and back/forward restore the search. */
const parsers = {
  q: withUrlDefaults(parseAsString).withDefault(""),
  kind: withUrlDefaults(parseAsArrayOf(parseAsStringLiteral(EXPLORE_KINDS))).withDefault([]),
  open: withUrlDefaults(parseAsStringLiteral(EXPLORE_OPEN)),
  within: withUrlDefaults(parseAsStringLiteral(RADII)),
  near: withUrlDefaults(parseAsArrayOf(parseAsFloat)),
  view: withUrlDefaults(parseAsArrayOf(parseAsFloat)),
};

const pair = (v: readonly number[] | null): readonly [number, number] | null => (v?.length === 2 ? [v[0]!, v[1]!] : null);

export interface ExploreView3 {
  center: readonly [number, number];
  zoom: number;
}

/** The camera kept in the address, when it holds a whole `lng,lat,zoom`. */
export function cameraOf(v: readonly number[] | null): ExploreView3 | null {
  return v?.length === 3 ? { center: [v[0]!, v[1]!], zoom: v[2]! } : null;
}

/** The explorer's filters and camera as the address holds them (one `replace` history entry per change: no back-button flood). */
export function useExploreUrl() {
  const [raw, setRaw] = useQueryStates(parsers);
  const state: ExploreUrlState = { q: raw.q, kinds: raw.kind, open: raw.open, near: pair(raw.near), within: raw.within ? (Number(raw.within) as ExploreRadius) : null };
  const apply = (next: ExploreUrlState) =>
    setRaw({ q: next.q || null, kind: next.kinds.length > 0 ? [...next.kinds] : null, open: next.open, near: next.near ? [...next.near] : null, within: next.near && next.within ? (String(next.within) as (typeof RADII)[number]) : null });
  const camera = cameraOf(raw.view);
  // @fixed: four decimals are about ten metres, one decimal of zoom is a quarter step: enough to restore a view, and the address stays short
  const round = (n: number, d: number) => Number(n.toFixed(d));
  const setCamera = (center: readonly [number, number], zoom: number) => setRaw({ view: [round(center[0], 4), round(center[1], 4), round(zoom, 1)] });
  return { state, apply, camera, setCamera };
}
