import { shopPresets } from "@krizaka/tokens/shop-presets";
import { shopStarters, type ShopPage, type ShopStarterId } from "@krizaka/ui/shop";

import type { ShopType } from "./shop-media";

/**
 * The shop page as a document (akinaza#400, ADR-007): the @krizaka/ui/shop format, stored in `shop_page_versions`.
 * Here lives the one table that turns today's page (the legacy `shop_page.sections` list) into that document;
 * the migration's SQL is generated from it (`packages/db/src/shop-page-document-migration.ts`), so the two cannot drift.
 */

/** The legacy sections, in the order of the stored list; `follow` has no document (it only ever said « coming »). */
export const LEGACY_SECTION_IDS = ["services", "team", "hours", "zones", "trust", "gallery", "wall", "reels", "announcements", "reviews", "follow"] as const;
export type LegacySectionId = (typeof LEGACY_SECTION_IDS)[number];

/** A section of the document as the table writes it (the key is derived from the legacy id and the rank). */
export interface DocSection {
  type: string;
  variant: string;
  settings: Record<string, unknown>;
  blocks?: { key: string; type: string; settings: Record<string, unknown> }[];
}

/** What each legacy section becomes: one or more sections of the document, in order. @fixed: ADR-007 §6, the page migration table. */
export const LEGACY_SECTION_DOCS: Readonly<Record<LegacySectionId, readonly DocSection[]>> = {
  services: [{ type: "services", variant: "cards", settings: { source: "all", groupBy: "none", columns: 1, aside: "none" } }],
  team: [{ type: "team", variant: "row", settings: { source: "all" } }],
  hours: [{ type: "visit", variant: "card", settings: { showPhone: false } }],
  zones: [{ type: "visit", variant: "map", settings: { showPhone: false } }],
  trust: [
    { type: "story", variant: "owner", settings: { body: {} } },
    { type: "policies", variant: "inline", settings: { show: ["cancellation", "prices", "booking-window"] } },
  ],
  gallery: [{ type: "gallery", variant: "grid", settings: { source: "all", texture: "plaster" } }],
  wall: [{ type: "gallery", variant: "wall", settings: { source: "all", texture: "plaster" } }],
  reels: [
    { type: "video", variant: "tv", settings: { cabinet: "cabinet" } },
    { type: "video", variant: "shorts", settings: { cabinet: "cabinet" } },
    { type: "social", variant: "links", settings: {} },
  ],
  announcements: [{ type: "bulletin", variant: "board", settings: {} }],
  reviews: [{ type: "reviews", variant: "summary-cards", settings: { rule: "best", count: 3 } }],
  follow: [],
};

/** The hero opens every page; the closing call and the sticky bar close it. */
export const HERO_SECTION: DocSection = {
  type: "hero",
  variant: "poster",
  settings: { focus: "center" },
  blocks: [
    { key: "b_open_now", type: "fact", settings: { kind: "open-now" } },
    { key: "b_area", type: "fact", settings: { kind: "area" } },
  ],
};
export const BOOKING_SECTIONS: readonly DocSection[] = [
  { type: "booking", variant: "closing", settings: { count: 4 } },
  { type: "booking", variant: "sticky", settings: { count: 4 } },
];

/** What migration 0038 wrote at the end of every existing page (the panel, then the bar). Frozen: a stored page keeps drawing it; a new one closes with `BOOKING_SECTIONS`. */
export const MIGRATION_0038_BOOKING_SECTIONS: readonly DocSection[] = [
  { type: "booking", variant: "panel", settings: { count: 4 } },
  { type: "booking", variant: "sticky", settings: { count: 4 } },
];

/** The look preset a trade starts on (the first look of each, ADR-007 §4). */
export const TRADE_PRESETS: Readonly<Record<ShopType, string>> = {
  salon: "salon-vitrine",
  pets: "pets-canal",
  coaching: "coaching-studio",
  workshop: "workshop-etabli",
  cleaning: "cleaning-net",
  consulting: "consulting-bureau",
};

export function presetOf(trade: ShopType): { id: string; version: number } {
  const id = TRADE_PRESETS[trade];
  const preset = shopPresets.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown shop preset ${id}`);
  return { id: preset.id, version: preset.version };
}

export const sectionKey = (legacy: string, rank: number, count: number) => (count > 1 ? `s_${legacy}_${rank + 1}` : `s_${legacy}`);

/** The stored list that predates `trust` is read with it right before `gallery` (at the end without one), exactly as `withTrust` does. */
export function withTrustLegacy<T extends { id: string; visible: boolean }>(sections: readonly T[]): (T | { id: "trust"; visible: boolean })[] {
  if (sections.some((s) => s.id === "trust")) return [...sections];
  const at = sections.findIndex((s) => s.id === "gallery");
  const out: (T | { id: "trust"; visible: boolean })[] = [...sections];
  out.splice(at < 0 ? out.length : at, 0, { id: "trust", visible: true });
  return out;
}

/** Today's page as a document: same sections, same order, a hidden one `disabled`; the hero first and the booking bar last. Pure. */
export function documentFromLegacy(input: { sections: readonly { id: string; visible: boolean }[]; trade: ShopType; booking?: readonly DocSection[] }): ShopPage {
  const sections: Record<string, unknown>[] = [];
  const push = (key: string, doc: DocSection, disabled = false) => sections.push({ key, ...doc, ...(disabled ? { disabled: true } : {}) });
  push("s_hero", HERO_SECTION);
  for (const legacy of withTrustLegacy(input.sections)) {
    const docs = LEGACY_SECTION_DOCS[legacy.id as LegacySectionId];
    if (!docs) continue;
    docs.forEach((doc, rank) => push(sectionKey(legacy.id, rank, docs.length), doc, !legacy.visible));
  }
  (input.booking ?? BOOKING_SECTIONS).forEach((doc) => push(`s_booking_${doc.variant}`, doc));
  return { schema: 1, preset: presetOf(input.trade), sections } as unknown as ShopPage;
}

const STARTER_BY_TRADE: Readonly<Record<ShopType, ShopStarterId>> = {
  salon: "salonCompact",
  pets: "petsRoute",
  coaching: "salonCompact",
  workshop: "salonCompact",
  cleaning: "salonCompact",
  consulting: "salonCompact",
};

/** A new salon starts on the compact starter (pets on the route); a shop that never saved a page reads it, nothing is written on a public read. */
export function starterFor(trade: ShopType): ShopPage {
  return structuredClone(shopStarters[STARTER_BY_TRADE[trade]]) as ShopPage;
}
export const starterIdFor = (trade: ShopType): ShopStarterId => STARTER_BY_TRADE[trade];


/**
 * The two demo shops are the Krizaka UI showcase (akinaza#404): their public page offers the other compositions of its trade through a « See it another way »
 * switch (`?look=`), and only theirs. The first look is the page's own (the document the shop publishes); the others are the starters of @krizaka/ui/shop
 * drawn with the same shop data. A shop that is not a demo has no switch: its owner decides, in the composer.
 */
export const DEMO_LOOKS: Readonly<Record<string, readonly { id: string; starter: ShopStarterId }[]>> = {
  "cedre-ciseaux": [
    { id: "compact", starter: "salonCompact" },
    { id: "editorial", starter: "salonEditorial" },
    { id: "gallery", starter: "salonGallery" },
  ],
  "pattes-saint-henri": [
    { id: "route", starter: "petsRoute" },
    { id: "journal", starter: "petsJournal" },
  ],
};

/** The looks a demo shop offers (empty for any other shop: no switch). */
export const demoLooksOf = (slug: string): readonly { id: string; starter: ShopStarterId }[] => DEMO_LOOKS[slug] ?? [];

/** The document of a demo shop's look named by `?look=`, or null when the shop is not a demo, the name is unknown, or it is the page's own (the first). */
export function demoLookDocument(slug: string, look: string | undefined): ShopPage | null {
  const looks = demoLooksOf(slug);
  const found = looks.find((l) => l.id === look);
  if (!found || found === looks[0]) return null;
  return structuredClone(shopStarters[found.starter]) as ShopPage;
}
