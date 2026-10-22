import type { ShopPermission, ShopRole } from "@akinaza/db";

import { may } from "./member-shop";

/** The places of a shop's space, each with what it takes to see it: the bar shows what a role may open, nothing else. */
const SHOP_PLACES = [
  { key: "today", needs: "agenda" },
  { key: "clients", needs: "clients" },
  { key: "invoices", needs: "invoices" },
  { key: "books", needs: "reports" },
  { key: "team", needs: "team" },
  { key: "shop", needs: "settings" },
  { key: "profile", needs: null },
] as const satisfies readonly { key: string; needs: ShopPermission | null }[];

export type AppPlace = (typeof SHOP_PLACES)[number]["key"] | "bookings";

/** What someone who works in no shop (a client) sees. */
export const CLIENT_PLACES: readonly AppPlace[] = ["bookings", "shop", "profile"];

export const placesFor = (role: ShopRole): AppPlace[] => SHOP_PLACES.filter((p) => p.needs === null || may(role, p.needs)).map((p) => p.key);
