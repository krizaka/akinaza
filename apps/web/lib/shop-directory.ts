/**
 * Which shop a shop host names (ADR-005 slice 4, akinaza#549). The proxy answers 404 to a well-formed slug that is no shop, before anything is routed or
 * rendered from it. It reads the answer through an internal route (the proxy has no database of its own: the cluster's connection budget is one), and keeps it
 * a short while: positive answers a minute, negative ones a few seconds (a shop just published is reachable at once), at most `MAX` entries (a flood of random
 * labels costs misses, never memory). A lookup that fails is never cached and never refuses: the page layer answers 404 for an unknown shop all the same.
 */
export const Verdict = { Shop: "shop", Moved: "moved", None: "none", Unknown: "unknown" } as const;
export type ShopVerdict = { kind: typeof Verdict.Shop } | { kind: typeof Verdict.Moved; slug: string } | { kind: typeof Verdict.None } | { kind: typeof Verdict.Unknown };

export type ShopLookup = (slug: string) => Promise<ShopVerdict>;

export const SHOP_LOOKUP_PATH = "/api/internal/shop-exists";
export const SHOP_SITEMAP_PATH = "/api/internal/shop-sitemap";

const HIT_MS = 60_000;
const MISS_MS = 10_000;
const MAX = 1000;

type Seen = Map<string, { verdict: ShopVerdict; until: number }>;

/**
 * The memory the proxy reads, kept on `globalThis` so that a route handler of the same process (publish, rename, hold) can empty it: the proxy and the routes are
 * separate bundles, one module graph each. Another instance learns the change within the TTLs above.
 */
const SHARED = Symbol.for("akinaza.shop-directory");
function sharedMemory(): Seen {
  const holder = globalThis as unknown as Record<symbol, Seen | undefined>;
  const memory = holder[SHARED] ?? new Map();
  holder[SHARED] = memory;
  return memory;
}

/** A shop was published, unpublished, held, cleared or renamed (akinaza#549): the next request on its host asks the database again, here at once. */
export function forgetShops(): void {
  sharedMemory().clear();
}

export function createShopDirectory(lookup: ShopLookup, now: () => number = Date.now, seen: Seen = sharedMemory()) {
  return async function verdictOf(slug: string): Promise<ShopVerdict> {
    const cached = seen.get(slug);
    if (cached && cached.until > now()) {return cached.verdict;}
    seen.delete(slug);
    const verdict = await lookup(slug).catch((): ShopVerdict => ({ kind: Verdict.Unknown }));
    if (verdict.kind === Verdict.Unknown) {return verdict;}
    seen.set(slug, { verdict, until: now() + (verdict.kind === Verdict.None ? MISS_MS : HIT_MS) });
    if (seen.size > MAX) {seen.delete(seen.keys().next().value as string);}
    return verdict;
  };
}

type Answer = { slug?: string | null; moved?: string | null };

/** The internal route answers `{ slug }` (a published shop), `{ moved }` (a former address) or `{}`. */
export function verdictFromAnswer(answer: Answer | null): ShopVerdict {
  if (!answer) {return { kind: Verdict.Unknown };}
  if (answer.slug) {return { kind: Verdict.Shop };}
  return answer.moved ? { kind: Verdict.Moved, slug: answer.moved } : { kind: Verdict.None };
}

/** The proxy's lookup: a same-process call to the internal route, on the loopback (the route is exempt from the host check: lib/allowed-hosts.ts). */
export const fetchShopVerdict: ShopLookup = async (slug) => {
  const res = await fetch(`http://127.0.0.1:${process.env.PORT ?? "3000"}${SHOP_LOOKUP_PATH}?slug=${encodeURIComponent(slug)}`, { cache: "no-store", signal: AbortSignal.timeout(2000) });
  return res.ok ? verdictFromAnswer((await res.json()) as Answer) : { kind: Verdict.Unknown };
};

export const shopVerdict = createShopDirectory(fetchShopVerdict);
