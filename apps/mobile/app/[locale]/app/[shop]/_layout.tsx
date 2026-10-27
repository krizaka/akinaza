import { BillingIcon, BookmarkIcon, ClockIcon, HomeIcon, UsersIcon } from "@krizaka/icons/native";
import { TabBar } from "@krizaka/ui/native";
import { Tabs, useRouter } from "expo-router";
import * as React from "react";

import { type TabName,TABS } from "@/domain/links";
import { useI18n } from "@/i18n";
import { useLocale } from "@/use-locale";
import { useShop } from "@/use-shop";

// The web rail's icons (apps/web ShopFrame), place for place.
const ICONS: Record<TabName, (color: string) => React.ReactNode> = {
  aujourdhui: (color) => <ClockIcon color={color} />,
  clients: (color) => <UsersIcon color={color} />,
  invoices: (color) => <BillingIcon color={color} />,
  books: (color) => <BookmarkIcon color={color} />,
  boutique: (color) => <HomeIcon color={color} />,
};

/**
 * The shop's space: the web rail's five places, in its order and words (D8) — Aujourd'hui (the day strip holds the calendar),
 * Clients, Factures, Livres, Boutique. The settings are the account's, under the avatar of every header. The URL is the state.
 */
export default function ShopTabs() {
  const { t } = useI18n();
  const { locale } = useLocale();
  const shop = useShop();
  const router = useRouter();
  const items = TABS.map((tab) => ({ value: tab.name, label: t(tab.label), icon: (_on: boolean, color: string) => ICONS[tab.name](color) }));
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state }) => {
        // « Vos chiffres » is opened from Livres, so Livres stays the lit tab.
        const name = state.routes[state.index]?.name.split("/")[0];
        const active = (name === "figures" ? "books" : name) as TabName;
        return <TabBar aria-label={t("tabs.label")} items={items} value={active} onValueChange={(name) => router.navigate(TABS.find((tab) => tab.name === name)!.href(locale, shop) as never)} />;
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
      {/* « Vos chiffres » is opened from Livres, never from the bar: still a place of this navigator, declared, or the router leaves it for the first tab. */}
      <Tabs.Screen name="figures" />
    </Tabs>
  );
}
