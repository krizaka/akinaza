import { feedFlyers } from "@akinaza/db";

import { db } from "@/lib/db";
import { buildFeed, type FeedView } from "@/lib/feed-view";
import type { Locale } from "@/lib/i18n";
import { shopSectionFeatures } from "@/lib/settings";

/**
 * The feed the home draws on the server (the first paint; a neighbourhood asks `/api/feed`). The home never breaks for it:
 * the board off, or the database unreachable, is an empty feed, and an empty feed draws no section.
 */
export async function homeFeed(locale: Locale): Promise<FeedView> {
  const none = buildFeed({ rows: [], locale });
  try {
    if (!(await shopSectionFeatures()).announcements) return none;
    return buildFeed({ rows: await feedFlyers(db()), locale });
  } catch {
    return none;
  }
}
