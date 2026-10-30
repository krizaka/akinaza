import { EXPLORE_KINDS, EXPLORE_OPEN, EXPLORE_RADII } from "./explore-query";

export type ExploreKind = (typeof EXPLORE_KINDS)[number];
export type ExploreOpen = (typeof EXPLORE_OPEN)[number];
export type ExploreRadius = (typeof EXPLORE_RADII)[number];

/** The filters of Explorer as the page's address holds them (ADR-006 decision 2): the text, the kinds, the opening, the visitor's position and the radius around it. */
export interface ExploreUrlState {
  q: string;
  kinds: readonly ExploreKind[];
  open: ExploreOpen | null;
  near: readonly [number, number] | null;
  within: ExploreRadius | null;
}

export const EXPLORE_NO_FILTERS: ExploreUrlState = { q: "", kinds: [], open: null, near: null, within: null };

// @fixed: the shortest text the endpoint accepts (exploreQuerySchema `q`.min(2)); a shorter one is held back, not sent
const MIN_TEXT = 2;
// @fixed: five decimals are about a metre; the position in a request and a cache key needs no more
const COORD_DECIMALS = 5;

const text = (q: string) => q.trim();
const textCounts = (q: string) => text(q).length >= MIN_TEXT;
const coord = (n: number) => String(Number(n.toFixed(COORD_DECIMALS)));

/** Whether any filter is on (what « clear all » and the empty state's way back depend on). */
export function hasExploreFilters(s: ExploreUrlState): boolean {
  return textCounts(s.q) || s.kinds.length > 0 || s.open !== null || s.near !== null;
}

/**
 * The query string `GET /api/explore/shops` takes for this state: one fixed order, kinds sorted, nothing the endpoint would refuse
 * (a text under two letters, a radius without a position), so equal states are one request and one cache key.
 */
export function exploreRequest(s: ExploreUrlState): string {
  const params = new URLSearchParams();
  if (textCounts(s.q)) params.set("q", text(s.q));
  if (s.kinds.length > 0) params.set("kind", EXPLORE_KINDS.filter((k) => s.kinds.includes(k)).join(","));
  if (s.open) params.set("open", s.open);
  if (s.near) {
    params.set("near", s.near.map(coord).join(","));
    if (s.within) params.set("within", String(s.within));
  }
  return params.toString();
}

export interface ExploreChip {
  group: "q" | "kind" | "open" | "near" | "within";
  /** The text, the kind, the opening or the radius; `here` for the position (its place name is the page's, not the state's). */
  value: string;
}

/** The removable chips of the filter bar, in the order the groups appear. */
export function exploreChips(s: ExploreUrlState): ExploreChip[] {
  const chips: ExploreChip[] = [];
  if (textCounts(s.q)) chips.push({ group: "q", value: text(s.q) });
  chips.push(...EXPLORE_KINDS.filter((k) => s.kinds.includes(k)).map((k): ExploreChip => ({ group: "kind", value: k })));
  if (s.open) chips.push({ group: "open", value: s.open });
  if (s.near) chips.push({ group: "near", value: "here" });
  if (s.near && s.within) chips.push({ group: "within", value: String(s.within) });
  return chips;
}

/** The state without one chip. Dropping the position drops the radius too: a radius is around a position. */
export function withoutChip(s: ExploreUrlState, chip: ExploreChip): ExploreUrlState {
  switch (chip.group) {
    case "q":
      return { ...s, q: "" };
    case "kind":
      return { ...s, kinds: s.kinds.filter((k) => k !== chip.value) };
    case "open":
      return { ...s, open: null };
    case "near":
      return { ...s, near: null, within: null };
    case "within":
      return { ...s, within: null };
  }
}

/** « Clear all »: every group empty. */
export function clearExplore(): ExploreUrlState {
  return EXPLORE_NO_FILTERS;
}
