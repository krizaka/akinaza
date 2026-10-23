import { CalendarIcon, ClockIcon, SettingsIcon, UserIcon, WalletIcon } from "@krizaka/icons/native";
import { TabBar } from "@krizaka/ui/native";
import { Redirect, Tabs, useRouter } from "expo-router";

import { AUTH, useAuth } from "@/auth";
import { routes } from "@/domain/links";
import { useI18n } from "@/i18n";
import { useLocale } from "@/use-locale";

type TabName = "index" | "calendar" | "invoices" | "clients" | "settings";

/** The owner's space: five tabs, each a route (the URL is the state); signed out, the way is back to sign-in. */
export default function AppLayout() {
  const { t } = useI18n();
  const { status } = useAuth();
  const { locale } = useLocale();
  const router = useRouter();
  if (status === AUTH.signedOut) return <Redirect href="/sign-in" />;
  const items = [
    { value: "index", label: t("tabs.today"), icon: (_on: boolean, color: string) => <ClockIcon color={color} /> },
    { value: "calendar", label: t("tabs.calendar"), icon: (_on: boolean, color: string) => <CalendarIcon color={color} /> },
    { value: "invoices", label: t("tabs.invoices"), icon: (_on: boolean, color: string) => <WalletIcon color={color} /> },
    { value: "clients", label: t("tabs.clients"), icon: (_on: boolean, color: string) => <UserIcon color={color} /> },
    { value: "settings", label: t("tabs.settings"), icon: (_on: boolean, color: string) => <SettingsIcon color={color} /> },
  ] as const;
  const hrefs: Record<TabName, string> = { index: routes.today(locale), calendar: routes.calendar(locale), invoices: routes.invoices(locale), clients: routes.clients(locale), settings: routes.settings(locale) };
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state }) => {
        const active = state.routes[state.index]?.name.split("/")[0] as TabName;
        return <TabBar aria-label={t("tabs.label")} items={items} value={active} onValueChange={(name) => router.navigate(hrefs[name] as never)} />;
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="invoices" />
      <Tabs.Screen name="clients" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
