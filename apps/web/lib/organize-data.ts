import { idsMatching, tagCounts, type WorkspaceKind } from "@akinaza/db";
import { parseView, type ViewFilters } from "@krizaka/organize/contract";

import type { OrganizeData } from "./organize-view";
import { actorOf, ensureWorkspace, rows, workspace } from "./workspace";

type Params = Record<string, string | string[] | undefined>;

/**
 * Everything a list page reads to organise its rows: the shop's tags with their counts, the views, the filters of the address and,
 * when a filter is in force, the ids the shop's rows are kept to. `ignore` leaves a filter to the page (Clients searches `q` itself,
 * without accents). The first call seeds the shop's default tag set.
 */
export async function organizeData(shopId: string, kind: WorkspaceKind, session: { id: string; email: string }, role: string, params: Params, ignore: readonly (keyof ViewFilters)[] = []) {
  await ensureWorkspace(shopId);
  const ws = workspace(shopId);
  const { view, filters } = parseView(params);
  const [tags, counts, views, config] = await Promise.all([ws.tags.list(shopId, kind), tagCounts(rows, kind, shopId), ws.views.list(shopId, actorOf(session, role), kind), ws.config.get(kind)]);
  const applied = { ...filters };
  for (const key of ignore) delete applied[key];
  const ids = await idsMatching(rows, kind, shopId, applied);
  const data: OrganizeData = {
    kind,
    canWrite: config?.config.tags.writers.includes(role) ?? false, // the administrator's configuration says who writes
    tags: tags.map(({ id, name, marker }) => ({ id, name, marker })),
    counts: Object.fromEntries(counts),
    views,
    filters,
    view,
  };
  return { data, ids: ids === null ? null : new Set(ids) };
}

/** The tags each entity wears, as plain data for its rows. */
export async function tagsOfRows(shopId: string, kind: WorkspaceKind, entityIds: readonly string[]) {
  const worn = await workspace(shopId).tags.of(shopId, kind, entityIds);
  return Object.fromEntries([...worn].map(([id, tags]) => [id, tags.map(({ id: tagId, name, marker }) => ({ id: tagId, name, marker }))]));
}
