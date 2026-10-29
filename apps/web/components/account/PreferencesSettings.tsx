"use client";

import { krizakaFetch } from "@krizaka/query";
import { appearance } from "@krizaka/tokens";
import { AppearanceSettings, type ThemeCardOption } from "@krizaka/ui/account-settings";
import { SettingsSection } from "@krizaka/ui/settings-layout";
import { useAppearance } from "@krizaka/ui/theme";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { useSay } from "@/lib/i18n-client";
import { accountRoutes } from "@/lib/routes";

const LANGUAGES = [
  { code: "fr", name: "Français" },
  { code: "en", name: "English" },
] as const;

export interface PreferencesView {
  locale: "en" | "fr";
}

/** What the account keeps of a theme: the mode (a surface set is dark). The set itself, the density and the accent stay on this device. */
const modeOf = (themeId: string): "light" | "dark" | "system" => (themeId === "light" || themeId === "system" ? themeId : "dark");

/**
 * Appearance (ADR-006 §4, krizaka-ui#657): the package's `AppearanceSettings` over `useAppearance()`. The theme set is the product register's —
 * System, Light, Dark and the optional Blueprint and Carbone surfaces, never the Cahier papers (those are the public shop pages'). A choice
 * applies at once; the mode is saved on the account, the language reloads the page in it. Akinaza keeps its own accent (no accent row), and no sound.
 */
export function PreferencesSettings({ preferences }: Readonly<{ preferences: PreferencesView }>) {
  const { say } = useSay();
  const router = useRouter();
  const state = useAppearance();
  const themes = useMemo<ThemeCardOption[]>(() => {
    const light = appearance.themes.find((t) => t.id === "light")?.preview;
    const dark = appearance.themes.find((t) => t.id === "dark")?.preview;
    return appearance.themes.map((t) => ({
      id: t.id,
      label: say(`account.preferences.themes.${t.id}.title`),
      description: say(`account.preferences.themes.${t.id}.hint`),
      preview: t.preview,
      ...(t.id === "system" && light && dark ? { halves: [light, dark] as const } : {}),
    }));
  }, [say]);
  const save = (patch: { locale?: string; theme?: string }) => krizakaFetch("/api/me/profile", { method: "PATCH", json: patch });
  return (
    <SettingsSection variant="flat" title={say("account.profile.sections.preferences")} description={say("account.preferences.description")}>
      <AppearanceSettings
        themes={themes}
        theme={state.themeId}
        onThemeChange={(id) => {
          state.setThemeId(id);
          void save({ theme: modeOf(id) });
        }}
        densities={appearance.densities.map((value) => ({ value, label: say(`account.preferences.densities.${value}`) }))}
        density={state.density}
        onDensityChange={state.setDensity}
        languages={LANGUAGES}
        language={preferences.locale}
        onLanguageChange={async (code) => {
          await save({ locale: code });
          if (code !== preferences.locale) router.replace(accountRoutes(code as "en" | "fr").section("preferences"));
        }}
        labels={{
          theme: say("account.preferences.appearance.theme"),
          themeHint: say("account.preferences.appearance.themeHint"),
          density: say("account.preferences.appearance.density"),
          densityHint: say("account.preferences.appearance.densityHint"),
          language: say("account.preferences.appearance.language"),
          languageHint: say("account.preferences.appearance.languageHint"),
        }}
      />
    </SettingsSection>
  );
}
