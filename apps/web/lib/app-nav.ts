import type { ShopPermission, ShopRole } from "@akinaza/db";

import { may } from "./member-shop";
import { accountRoutes, type RouteLocale, shopRoutes } from "./routes";

/**
 * The five destinations of a shop's space (docs/ux/2026-10-full-review.md § 4.1): where you work is on the rail, who you are is
 * under the avatar — never a place in both. Each place names what it takes to see it: the rail shows what a role may open, nothing
 * else. « Boutique » gathers everything that configures the shop (the hub, lib/boutique): it leads to the page for who may set the
 * shop up, and to the team for who may only see the team.
 */
const SHOP_PLACES = [
  { key: "today", needs: ["agenda"] },
  { key: "clients", needs: ["clients"] },
  { key: "invoices", needs: ["invoices"] },
  { key: "books", needs: ["reports"] },
  { key: "shop", needs: ["settings", "team"] },
] as const satisfies readonly { key: string; needs: readonly ShopPermission[] }[];

export type AppPlace = (typeof SHOP_PLACES)[number]["key"] | "bookings";

/** What someone who works in no shop (a client) sees: their bookings. The account is under the avatar, like everyone's. */
export const CLIENT_PLACES: readonly AppPlace[] = ["bookings"];

/** The rail of a role: five at most, in the order of the day. */
export const placesFor = (role: ShopRole): AppPlace[] => SHOP_PLACES.filter((p) => p.needs.some((need) => may(role, need))).map((p) => p.key);

/** Where a place leads for a person working in `shopId` as `role` (or in none: a client). */
export function placeHrefFor(locale: RouteLocale, member: { shopId: string; role: ShopRole } | null, place: AppPlace): string {
  if (place === "bookings" || member === null) return accountRoutes(locale).home;
  const shop = shopRoutes(locale, member.shopId);
  const hrefs: Record<Exclude<AppPlace, "bookings">, string> = { today: shop.today(), clients: shop.clients, invoices: shop.invoices, books: shop.books(), shop: may(member.role, "settings") ? shop.setup : shop.team };
  return hrefs[place];
}

/**
 * The frame's one primary action, « Nouvelle facture », is for the screens that have no primary of their own (the list, Today). The
 * settings hub, and an invoice's own screens (its detail, its correction, the new invoice), keep their own action: the header yields.
 */
export const headerActionFits = (pathname: string): boolean => !/\/boutique(\/|$)/.test(pathname) && !/\/invoices\/[^/]+/.test(pathname);
