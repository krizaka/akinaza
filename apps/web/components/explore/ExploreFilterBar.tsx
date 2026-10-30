"use client";

import { EXPLORE_KINDS, EXPLORE_OPEN, EXPLORE_RADII, type ExploreChip, exploreChips, type ExploreKind, type ExploreOpen, type ExploreRadius, type ExploreUrlState, withoutChip } from "@akinaza/core";
import { type ActiveFilter, FilterBar, FilterMenu } from "@krizaka/ui/filter-bar";
import { SearchField } from "@krizaka/ui/search-field";
import { useState } from "react";

/** The words of the bar, said on the server from the catalogue (`explore.filters`). */
export interface ExploreFilterWords {
  label: string; kind: string; all: string; salon: string; boutique: string; services: string; other: string; openNow: string; freeToday: string;
  text: string; textPlaceholder: string; opening: string; week: string; distance: string; km: string; distanceNeeds: string; clearAll: string; remove: string; active: string; here: string; updating: string; textChip: string;
}
type FilterWords = ExploreFilterWords;

const format = (message: string, values: Record<string, string>) => Object.entries(values).reduce((out, [key, value]) => out.replaceAll(`{${key}}`, value), message);

/** What a chip says, from the catalogue: the kind's name, the opening, the radius, the typed text. */
export function chipLabel(chip: ExploreChip, w: FilterWords): string {
  const openLabel: Record<ExploreOpen, string> = { now: w.openNow, week: w.week, "free-today": w.freeToday };
  switch (chip.group) {
    case "q":
      return format(w.textChip, { text: chip.value });
    case "kind":
      return w[chip.value as ExploreKind];
    case "open":
      return openLabel[chip.value as ExploreOpen];
    case "near":
      return w.here;
    case "within":
      return format(w.km, { km: chip.value });
  }
}

/**
 * The filter bar of Explorer (ADR-006 decision 1): the text, the kinds (several), the opening (one), the distance (one, around a
 * position), each active filter a removable chip, and « Clear all ». The state is the address's (`useExploreUrl`); a typed text
 * waits for a pause (the field's own debounce) before it reaches the address, and so the request.
 */
export function ExploreFilterBar({ state, words, count, busy, onChange, onClear }: Readonly<{ state: ExploreUrlState; words: FilterWords; count: string; busy: boolean; onChange: (next: ExploreUrlState) => void; onClear: () => void }>) {
  // What is being typed, until the pause commits it to the address (null = follow the address: back/forward, a removed chip, « Clear all »).
  const [typed, setTyped] = useState<string | null>(null);
  const active: ActiveFilter[] = exploreChips(state).map((chip) => ({
    id: `${chip.group}:${chip.value}`,
    label: chipLabel(chip, words),
    onRemove: () => {
      setTyped(null);
      onChange(withoutChip(state, chip));
    },
  }));
  const located = state.near !== null;
  return (
    <FilterBar label={words.label} active={active} onClearAll={() => { setTyped(null); onClear(); }} clearLabel={words.clearAll} removeLabel={(filter) => format(words.remove, { filter })} results={busy ? words.updating : count} data-testid="explore-filters">
      <SearchField
        label={words.text}
        placeholder={words.textPlaceholder}
        landmark={false}
        size="sm"
        value={typed ?? state.q}
        onValueChange={setTyped}
        onSearch={(q) => {
          setTyped(null);
          onChange({ ...state, q });
        }}
      />
      <FilterMenu
        label={words.kind}
        options={EXPLORE_KINDS.map((k) => ({ value: k, label: words[k] }))}
        value={state.kinds}
        onValueChange={(value) => onChange({ ...state, kinds: EXPLORE_KINDS.filter((k) => value.includes(k)) })}
      />
      <FilterMenu
        label={words.opening}
        multiple={false}
        options={EXPLORE_OPEN.map((o) => ({ value: o, label: chipLabel({ group: "open", value: o }, words) }))}
        value={state.open ?? ""}
        onValueChange={(value) => onChange({ ...state, open: (value || null) as ExploreOpen | null })}
      />
      <FilterMenu
        label={words.distance}
        multiple={false}
        options={EXPLORE_RADII.map((r) => ({ value: String(r), label: format(words.km, { km: String(r) }), disabled: !located }))}
        value={state.within ? String(state.within) : ""}
        onValueChange={(value) => onChange({ ...state, within: value ? (Number(value) as ExploreRadius) : null })}
      />
      {located ? null : <p className="m-0 w-full text-xs text-fg-secondary">{words.distanceNeeds}</p>}
    </FilterBar>
  );
}
