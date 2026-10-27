"use client";

import { type ExploreFilters, type ExploreShop, filterShops, NO_FILTERS, quartiersOf, rankByDistance, type RankedShop } from "@akinaza/core";
import { krizakaFetch, KrizakaQueryProvider, useQuery } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Input } from "@krizaka/ui/field";
import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";

import { ButtonLink } from "@/components/ButtonLink";
import { canLocate, distanceLabel, mapCenter, type Origin } from "@/lib/explore";
import type { GeoAttribution, GeoPlace } from "@/lib/geocoding";

const ExploreMap = dynamic(() => import("./ExploreMap"), { ssr: false, loading: () => <div className="h-full min-h-80 w-full animate-pulse rounded-2xl bg-surface" aria-hidden /> });

/** Every word of the page, said on the server from the catalogues (`explore`): this component holds none. */
export interface ExploreWords {
  search: { label: string; placeholder: string; submit: string; nearMe: string; nearMeBusy: string; clear: string; centredOn: string; centredOnYou: string; nearMeNote: string; denied: string; unavailable: string; off: string; none: string; pick: string; attribution: string };
  filters: { label: string; kind: string; all: string; salon: string; boutique: string; services: string; other: string; openNow: string; freeToday: string };
  list: { label: string; count: string; countOne: string; visit: string; open: string; free: string; away: string; notOnMap: string; quartiers: string };
  view: { list: string; map: string };
  map: { label: string; you: string };
  empty: { title: string; text: string; reset: string };
  error: { text: string; retry: string };
  loading: string;
}

const KINDS = ["salon", "boutique", "services", "other"] as const;
const WIDE = "(min-width: 1024px)";
const subscribeWide = (cb: () => void) => {
  const m = window.matchMedia(WIDE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

interface GeocodeAnswer {
  places: GeoPlace[];
  attribution: GeoAttribution;
}
type Locating = "idle" | "busy" | "denied";

/** What to say when the address search is off (503) or failed; nothing otherwise. */
function geoNotice(off: boolean, failed: boolean, words: ExploreWords): { tone: "info" | "danger"; text: string } | null {
  if (off) return { tone: "info", text: words.search.off };
  return failed ? { tone: "danger", text: words.search.unavailable } : null;
}

function Filters({ filters, kinds, words, onChange }: { filters: ExploreFilters; kinds: readonly (typeof KINDS)[number][]; words: ExploreWords; onChange: (next: ExploreFilters) => void }) {
  const pressed = (on: boolean) => ({ variant: on ? ("primary" as const) : ("ghost" as const), "aria-pressed": on, size: "sm" as const, type: "button" as const });
  return (
    <div role="group" aria-label={words.filters.label} className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-fg-secondary">{words.filters.kind}</span>
      <Button {...pressed(filters.kind === null)} onClick={() => onChange({ ...filters, kind: null })}>{words.filters.all}</Button>
      {kinds.map((k) => (
        <Button key={k} {...pressed(filters.kind === k)} onClick={() => onChange({ ...filters, kind: k })}>{words.filters[k]}</Button>
      ))}
      <Button {...pressed(filters.openNow)} onClick={() => onChange({ ...filters, openNow: !filters.openNow })}>{words.filters.openNow}</Button>
      <Button {...pressed(filters.freeToday)} onClick={() => onChange({ ...filters, freeToday: !filters.freeToday })}>{words.filters.freeToday}</Button>
    </div>
  );
}

function ShopCard({ shop, locale, words, selected, onShowOnMap }: { shop: RankedShop; locale: string; words: ExploreWords; selected: boolean; onShowOnMap: () => void }) {
  const line = [shop.area, { fr: shop.taglineFr, en: shop.taglineEn }[locale as "fr" | "en"]].filter(Boolean).join(" · ");
  return (
    <li className="rounded-2xl border border-border bg-surface p-4" data-selected={selected || undefined} aria-current={selected || undefined}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="m-0 text-base font-semibold text-fg">{shop.name}</h2>
        {shop.distanceMeters !== null ? <span className="shrink-0 text-sm text-fg-secondary">{words.list.away.replace("{distance}", distanceLabel(shop.distanceMeters, locale))}</span> : null}
      </div>
      <p className="m-0 mt-1 text-sm text-fg-secondary">{line}</p>
      <p className="m-0 mt-2 flex flex-wrap gap-x-3 text-xs text-fg-secondary">
        {shop.openNow ? <span>{words.list.open}</span> : null}
        {shop.freeToday ? <span>{words.list.free}</span> : null}
        {shop.point ? null : <span>{words.list.notOnMap}</span>}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <ButtonLink href={`/${locale}/s/${shop.slug}`} variant="primary" size="sm" shape="cut">{words.list.visit}</ButtonLink>
        {shop.point ? <Button type="button" variant="ghost" size="sm" aria-pressed={selected} onClick={onShowOnMap}>{words.view.map}</Button> : null}
      </div>
    </li>
  );
}

function SearchBar({ words, typed, onType, onSubmit, locating, onLocate, notice, denied }: { words: ExploreWords; typed: string; onType: (v: string) => void; onSubmit: () => void; locating: Locating; onLocate: () => void; notice: ReturnType<typeof geoNotice>; denied: boolean }) {
  return (
    <>
      <form role="search" aria-label={words.search.label} className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-fg-secondary">
          {words.search.label}
          <Input type="search" name="q" value={typed} placeholder={words.search.placeholder} autoComplete="street-address" maxLength={120} onChange={(e) => onType(e.target.value)} />
        </label>
        <Button type="submit" variant="primary" size="md" shape="cut" disabled={typed.trim().length < 3}>{words.search.submit}</Button>
        {canLocate() ? <Button type="button" variant="secondary" size="md" shape="cut" onClick={onLocate} disabled={locating === "busy"}>{locating === "busy" ? words.search.nearMeBusy : words.search.nearMe}</Button> : null}
      </form>
      <p className="m-0 text-xs text-fg-secondary">{words.search.nearMeNote}</p>
      {denied ? <Alert tone="warning">{words.search.denied}</Alert> : null}
      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
    </>
  );
}

function PlacePicker({ answer, query, origin, words, onPick }: { answer: GeocodeAnswer; query: string; origin: Origin | null; words: ExploreWords; onPick: (p: GeoPlace) => void }) {
  if (answer.places.length === 0) return <p role="status" className="m-0 text-sm text-fg-secondary">{words.search.none.replace("{query}", query)}</p>;
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-xs text-fg-secondary">
        {words.search.pick} · {words.search.attribution}{" "}
        <a className="underline" href={answer.attribution.href} target="_blank" rel="noopener noreferrer">{answer.attribution.text}</a>
      </p>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {answer.places.map((p) => (
          <li key={`${p.lat},${p.lng}`}>
            <Button type="button" variant="ghost" size="sm" aria-pressed={origin?.label === p.label} className="h-auto justify-start whitespace-normal text-left" onClick={() => onPick(p)}>{p.label}</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ShopList({ shown, ready, filtersOn, onReset, count, locale, words, selected, onShowOnMap }: { shown: RankedShop[]; ready: boolean; filtersOn: boolean; onReset: () => void; count: string; locale: string; words: ExploreWords; selected: string | null; onShowOnMap: (slug: string) => void }) {
  return (
    <section aria-label={words.list.label} className="flex min-w-0 flex-col gap-3" data-testid="explore-list">
      <p role="status" className="m-0 text-sm text-fg-secondary">{ready ? count : words.loading}</p>
      {ready && shown.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-2xl border border-border p-4" data-testid="explore-empty">
          <h2 className="m-0 text-base font-semibold text-fg">{words.empty.title}</h2>
          <p className="m-0 text-sm text-fg-secondary">{words.empty.text}</p>
          {filtersOn ? <Button type="button" variant="secondary" size="sm" onClick={onReset}>{words.empty.reset}</Button> : null}
        </div>
      ) : null}
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {shown.map((s) => (
          <ShopCard key={s.slug} shop={s} locale={locale} words={words} selected={s.slug === selected} onShowOnMap={() => onShowOnMap(s.slug)} />
        ))}
      </ul>
    </section>
  );
}

/** Where the visitor is, once, on a click: held in state, never sent, never stored. */
function useLocate(onFound: (o: Origin) => void) {
  const [locating, setLocating] = useState<Locating>("idle");
  const locate = () => {
    if (!canLocate()) return setLocating("denied");
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        onFound({ point: [p.coords.longitude, p.coords.latitude], label: null });
        setLocating("idle");
      },
      () => setLocating("denied"),
      { maximumAge: 60_000, timeout: 10_000 },
    );
  };
  return { locating, locate };
}

function Explorer({ locale, words }: { locale: string; words: ExploreWords }) {
  const [filters, setFilters] = useState<ExploreFilters>(NO_FILTERS);
  const [typed, setTyped] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => false);
  const { locating, locate } = useLocate((o) => {
    setOrigin(o);
    setSubmitted("");
  });

  const shops = useQuery({ queryKey: ["explore-shops"], queryFn: ({ signal }) => krizakaFetch("/api/explore/shops", { signal }) as Promise<{ shops: ExploreShop[] }>, staleTime: 30_000, retry: false, meta: { list: true } });
  const geo = useQuery({
    queryKey: ["explore-geocode", locale, submitted],
    enabled: submitted.length > 0,
    retry: false,
    // Both failures are said in the page (a notice, a retry), not thrown to the error boundary (`meta.list`, @krizaka/query).
    meta: { list: true },
    staleTime: 24 * 3_600_000,
    queryFn: ({ signal }) => krizakaFetch(`/api/explore/geocode?q=${encodeURIComponent(submitted)}&locale=${locale}`, { signal }) as Promise<GeocodeAnswer>,
  });

  const all = shops.data?.shops ?? [];
  const shown = rankByDistance(filterShops(all, filters), origin?.point ?? null);
  const quartiers = quartiersOf(shown);
  const count = (shown.length === 1 ? words.list.countOne : words.list.count).replace("{count}", String(shown.length)) + (quartiers.length ? ` · ${quartiers.join(", ")}` : "");
  const notice = geoNotice(Boolean(geo.error) && /503/.test(String(geo.error)), geo.isError, words);
  const clearOrigin = () => {
    setOrigin(null);
    setSubmitted("");
    setTyped("");
  };
  const showOnMap = (slug: string) => {
    setSelected(slug);
    setView("map");
  };

  return (
    <div className="flex flex-col gap-4" data-testid="explorer">
      <SearchBar words={words} typed={typed} onType={setTyped} onSubmit={() => setSubmitted(typed.trim())} locating={locating} onLocate={locate} notice={notice} denied={locating === "denied"} />
      {geo.data && submitted ? <PlacePicker answer={geo.data} query={submitted} origin={origin} words={words} onPick={(p) => { setOrigin({ point: [p.lng, p.lat], label: p.label }); setSelected(null); }} /> : null}
      {origin ? (
        <div className="flex flex-wrap items-center gap-2" role="status">
          <span className="text-sm text-fg">{origin.label ? words.search.centredOn.replace("{place}", origin.label) : words.search.centredOnYou}</span>
          <Button type="button" variant="ghost" size="sm" onClick={clearOrigin}>{words.search.clear}</Button>
        </div>
      ) : null}
      <Filters filters={filters} kinds={KINDS.filter((k) => all.some((s) => s.kind === k))} words={words} onChange={setFilters} />
      <div role="group" aria-label={`${words.view.list} / ${words.view.map}`} className="flex gap-2 lg:hidden">
        <Button type="button" size="sm" variant={view === "list" ? "primary" : "secondary"} aria-pressed={view === "list"} onClick={() => setView("list")}>{words.view.list}</Button>
        <Button type="button" size="sm" variant={view === "map" ? "primary" : "secondary"} aria-pressed={view === "map"} onClick={() => setView("map")}>{words.view.map}</Button>
      </div>
      {shops.isError ? (
        <Alert tone="danger">
          {words.error.text}{" "}
          <Button type="button" variant="ghost" size="sm" onClick={() => void shops.refetch()}>{words.error.retry}</Button>
        </Alert>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        {wide || view === "list" ? <ShopList shown={shown} ready={shops.isSuccess} filtersOn={filters.kind !== null || filters.openNow || filters.freeToday} onReset={() => setFilters(NO_FILTERS)} count={count} locale={locale} words={words} selected={selected} onShowOnMap={showOnMap} /> : null}
        {wide || view === "map" ? (
          <div className="h-[28rem] min-w-0 overflow-hidden rounded-2xl border border-border lg:sticky lg:top-24 lg:h-[36rem]" data-testid="explore-map">
            <ExploreMap shops={shown} selected={selected} onSelect={setSelected} origin={origin} center={mapCenter(shown, origin)} locale={locale} label={words.map.label} youLabel={words.map.you} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Explorer: shops by quartier on a map and in a list, searched by address or postal code, ranked by distance (data through @krizaka/query, never an effect). */
export function ExploreView(props: { locale: string; words: ExploreWords }) {
  return (
    <KrizakaQueryProvider>
      <Explorer {...props} />
    </KrizakaQueryProvider>
  );
}
