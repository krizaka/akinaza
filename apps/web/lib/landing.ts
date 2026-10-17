import { GST, QST } from "@akinaza/core";

/**
 * The landing's structure — ids and destinations, never words (the words are in messages/, keyed by the same ids).
 * One story: the promise and the real storefront, what you can do, how it works (the recorded journey), how it compares, trust, the FAQ, the closing call.
 */
export const HOME_SECTIONS = ["hero", "features", "how", "compare", "trust", "faq", "closing"] as const;

/** The demo shop of the first proof — a dog walker in Saint-Henri (fictional, seeded): its public page is real. */
export const DEMO_SHOP = "pattes-saint-henri";

/** What a shop gets — outcomes, not features — and where each card leads (no dead-end card). */
export const OUTCOMES = [
  { id: "bookings", to: "shop" },
  { id: "reports", to: "sign-in" },
  { id: "taxes", to: "sign-in" },
] as const;

/** How it works: who does what, in three steps. */
export const HOW_STEPS = ["book", "work", "books"] as const;

/** Why a shop can trust it: Loi 25 and Canada, the tax return prepared (never filed), the code. */
export const TRUST = ["canada", "prepare", "open"] as const;

type DevPreview = { criteria: Record<string, { evidence: string | null; na?: boolean }> };

/** The honest status chip, from dev-preview.json: « Dev preview » only once every criterion has its evidence. */
export function productStatus(preview: DevPreview): "development" | "preview" {
  return Object.values(preview.criteria).every((c) => c.evidence !== null || c.na === true) ? "preview" : "development";
}

/** The band's figures, read from the tax code (`@akinaza/core`) and the languages the app speaks — never typed in a message. */
export const FIGURES = {
  gst: (GST.numerator * 100) / GST.denominator,
  qst: (QST.numerator * 100) / QST.denominator,
  languages: 2,
} as const;

/** The rows of the comparison with the usual stack (a diary, a spreadsheet, an accountant): five, each honest about who does what. */
export const COMPARE_ROWS = ["booking", "day", "report", "taxes", "filing"] as const;

export const FAQ_IDS = ["open", "filing", "who", "data", "bilingual", "engine"] as const;
