import type { SavedView, SystemView, ViewFilters, WorkspaceTag } from "@krizaka/organize";
import { viewSearch } from "@krizaka/organize/contract";

/** What a list of clients or invoices needs to draw its tags, its binder dividers and its views (akinaza#337). Plain data: it crosses to the client. */
export interface OrganizeData {
  kind: "client" | "invoice";
  /** The owner and the manager write tags; anyone else reads them. */
  canWrite: boolean;
  tags: Pick<WorkspaceTag, "id" | "name" | "marker">[];
  /** How many of the shop's entities wear each tag. */
  counts: Record<string, number>;
  views: { system: SystemView[]; workspace: SavedView[]; mine: SavedView[] };
  /** The filters in force (from the address) and the view they came from. */
  filters: ViewFilters;
  view: string | null;
}

export type TagLite = OrganizeData["tags"][number];

/** The address of a list for some filters (the URL is the state): the organize parameters in their canonical order, then the list's own. */
export function listHref(path: string, filters: ViewFilters, view: string | null, own: Record<string, string | undefined> = {}): string {
  const params = new URLSearchParams(viewSearch(filters, view));
  for (const [key, value] of Object.entries(own)) if (value) params.set(key, value);
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

/** The marker of a tag as a hue of the binder's dividers (`Tabs.NavLink hue`): only the five the divider knows, the others read as neutral. */
export const MARKER_HUE = { blue: "accent", green: "success", amber: "warning", red: "danger", violet: "accent", gray: "neutral" } as const;
