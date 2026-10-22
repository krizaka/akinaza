"use client";

import { createContext, useContext, useEffect } from "react";

import { rememberShop } from "@/app/actions/remember-shop";
import { type RouteLocale, type ShopRoutes, shopRoutes } from "@/lib/routes";

const RoutesContext = createContext<ShopRoutes | null>(null);

/**
 * The shop of the address, for everything below it: its routes (every link of the space comes from here) and the memory of it as the
 * last shop worked in. The cookie only records the last shop; the address decides which one is open.
 */
export function ShopSession({ locale, shopId, remembered, children }: { locale: RouteLocale; shopId: string; remembered: boolean; children: React.ReactNode }) {
  useEffect(() => {
    if (!remembered) void rememberShop(shopId);
  }, [remembered, shopId]);
  return <RoutesContext.Provider value={shopRoutes(locale, shopId)}>{children}</RoutesContext.Provider>;
}

/** The routes of the shop the page belongs to, or null outside a shop's space. */
export const useOptionalShopRoutes = (): ShopRoutes | null => useContext(RoutesContext);

/** The routes of the shop the page belongs to. */
export function useShopRoutes(): ShopRoutes {
  const routes = useContext(RoutesContext);
  if (!routes) throw new Error("useShopRoutes needs a ShopSession above it");
  return routes;
}
