import type { Locale } from "./i18n";

/**
 * The landing's structure: ids and destinations, never words (the words are in messages/, keyed by the same ids).
 * One short story: the promise with the real app on a phone, the three jobs on real screens, the offer when it is live,
 * a quiet line of trust.
 */
export const HOME_SECTIONS = ["hero", "screens", "offer", "trust"] as const;

/** The demo shop of the first proof: a dog walker in Saint-Henri (fictional, seeded). Its public page is real. */
export const DEMO_SHOP = "pattes-saint-henri";

/**
 * The three jobs, each shown by the real component of the app drawn with demo data (components/home/previews, lib/landing-demo.ts).
 */
export const SCREENS = [
  { id: "book" },
  { id: "invoice" },
  { id: "books" },
] as const;

type DevPreview = { criteria: Record<string, { evidence?: string | null; na?: boolean | string }> };

/** The hero's actions, by the session (krizaka/akinaza#285): the messages are `landing.actions.<message>`. */
export type HeroActionMessage = "openShop" | "tryDemo" | "signIn";
export interface HeroAction {
  href: string;
  message: HeroActionMessage;
}

/** Signed in: « Open my shop » into the owner's app. Signed out: « Try the demo shop », with « Sign in » beside it. Never « Talk to us ». */
export function heroActions(locale: Locale, signedIn: boolean): { primary: HeroAction; secondary: HeroAction | null } {
  if (signedIn) return { primary: { href: `/${locale}/app`, message: "openShop" }, secondary: null };
  return { primary: { href: `/${locale}/s/${DEMO_SHOP}`, message: "tryDemo" }, secondary: { href: `/${locale}/sign-in`, message: "signIn" } };
}

/** The honest status, from dev-preview.json: « Dev preview » only once every criterion has its evidence. */
export function productStatus(preview: DevPreview): "development" | "preview" {
  return Object.values(preview.criteria).every((c) => Boolean(c.evidence) || Boolean(c.na)) ? "preview" : "development";
}
