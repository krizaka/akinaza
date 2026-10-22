/**
 * The landing's structure: ids and destinations, never words (the words are in messages/, keyed by the same ids).
 * One short story: the promise with the real app on a phone, the three jobs on real screens, the offer when it is live,
 * a quiet line of trust.
 */
export const HOME_SECTIONS = ["hero", "screens", "offer", "trust"] as const;

/** The demo shop of the first proof: a dog walker in Saint-Henri (fictional, seeded). Its public page is real. */
export const DEMO_SHOP = "pattes-saint-henri";

/** The three jobs, each shown on a real screen of the app (lib/tour.ts has the captures). */
export const SCREENS = [{ id: "book" }, { id: "invoice" }, { id: "books" }] as const;

type DevPreview = { criteria: Record<string, { evidence?: string | null; na?: boolean | string }> };

/** The honest status, from dev-preview.json: « Dev preview » only once every criterion has its evidence. */
export function productStatus(preview: DevPreview): "development" | "preview" {
  return Object.values(preview.criteria).every((c) => Boolean(c.evidence) || Boolean(c.na)) ? "preview" : "development";
}
