"use client";

import { krizakaFetch, KrizakaQueryProvider, useQuery } from "@krizaka/query";
import { Button } from "@krizaka/ui/button";
import { useState } from "react";

import { Bulletin } from "@/components/shop/Bulletin";
import type { FeedView } from "@/lib/feed-view";

/** The words of the feed, from the catalogues (`landing.feed`): the component holds none. */
export interface FeedWords {
  filterLabel: string;
  all: string;
  boardLabel: string;
  /** « See {shop} », the shop's name already in. */
  visit: string;
  empty: string;
  error: string;
}

function Feed({ initial, locale, words }: Readonly<{ initial: FeedView; locale: string; words: FeedWords }>) {
  const [quartier, setQuartier] = useState<string | null>(null);
  const feed = useQuery({
    queryKey: ["neighbourhood-feed", locale, quartier],
    queryFn: ({ signal }) => krizakaFetch(`/api/feed?locale=${locale}${quartier ? `&quartier=${encodeURIComponent(quartier)}` : ""}`, { signal }) as Promise<FeedView>,
    // The server drew the unfiltered board: it is the first answer, a neighbourhood asks the API.
    ...(quartier === null ? { initialData: initial } : {}),
    staleTime: 60_000,
  });
  const view = feed.data ?? { ...initial, flyers: [] };
  return (
    <div className="flex flex-col gap-6" data-testid="neighbourhood-feed">
      <div role="group" aria-label={words.filterLabel} className="flex flex-wrap gap-2">
        {[null, ...initial.quartiers].map((q) => (
          <Button key={q ?? "all"} type="button" size="sm" variant={q === quartier ? "primary" : "ghost"} aria-pressed={q === quartier} onClick={() => setQuartier(q)}>
            {q ?? words.all}
          </Button>
        ))}
      </div>
      {feed.isError ? <p role="alert" className="m-0 text-sm text-fg-secondary">{words.error}</p> : null}
      {view.flyers.length > 0 && <Bulletin flyers={view.flyers} label={words.boardLabel} visit={(shop) => words.visit.replace("{shop}", shop)} />}
      {view.flyers.length === 0 && !feed.isPending && !feed.isError && <p className="m-0 text-base text-fg-secondary">{words.empty}</p>}
    </div>
  );
}

/** The home's neighbourhood feed: flyers on the Cahier's board, a neighbourhood at a time (@krizaka/query, never an effect). */
export function NeighbourhoodFeed(props: Readonly<{ initial: FeedView; locale: string; words: FeedWords }>) {
  return (
    <KrizakaQueryProvider>
      <Feed {...props} />
    </KrizakaQueryProvider>
  );
}
