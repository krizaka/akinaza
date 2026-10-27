import { feedPeople, liveFeeds } from "@akinaza/db";

import { db } from "./db";
import { appSettings } from "./settings";

export interface FeedState {
  live: boolean;
  createdAt: string | null;
  rotatedAt: string | null;
}

export interface FeedOverview {
  enabled: boolean;
  /** The shop's own feed; null for a member who may open only their own. */
  shop: FeedState | null;
  people: ({ id: string; name: string } & FeedState)[];
}

/** The feeds a member may manage and whether each is live: never an address (only its hash is kept, so it cannot be shown again). */
export async function feedOverview(shopId: string, scope: { staffAccountId?: string }): Promise<FeedOverview> {
  if (!(await appSettings().get("exports.icsFeed.enabled"))) return { enabled: false, shop: null, people: [] };
  const [people, live] = await Promise.all([feedPeople(db(), shopId, scope), liveFeeds(db(), shopId)]);
  const state = (staffId: string | null): FeedState => {
    const feed = live.find((f) => f.staffId === staffId);
    return feed ? { live: true, createdAt: feed.createdAt.toISOString(), rotatedAt: feed.rotatedAt?.toISOString() ?? null } : { live: false, createdAt: null, rotatedAt: null };
  };
  return { enabled: true, shop: scope.staffAccountId ? null : state(null), people: people.map((p) => ({ id: p.id, name: p.name, ...state(p.id) })) };
}
