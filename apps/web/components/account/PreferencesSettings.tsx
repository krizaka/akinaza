"use client";

import { krizakaFetch } from "@krizaka/query";
import { ChoiceCards, LanguagePicker } from "@krizaka/ui/account-settings";
import { SettingsRow, SettingsSection } from "@krizaka/ui/settings-layout";
import { type Mode, useTheme } from "@krizaka/ui/theme";
import { useRouter } from "next/navigation";

import { useSay } from "@/lib/i18n-client";
import { accountRoutes } from "@/lib/routes";

import { useSectionDraft } from "./useSectionDraft";

const MODES: readonly Mode[] = ["light", "dark", "system"];
const LANGUAGES = [
  { code: "fr", name: "Français" },
  { code: "en", name: "English" },
] as const;

export interface PreferencesView {
  locale: "en" | "fr";
  theme: Mode | null;
}

/** Language and theme: saved on the account, applied at once on this device. A new language reloads the page in it. */
export function PreferencesSettings({ preferences }: { preferences: PreferencesView }) {
  const { say } = useSay();
  const router = useRouter();
  const { setMode } = useTheme();
  const form = useSectionDraft({ locale: preferences.locale, theme: preferences.theme ?? "system" }, async (values) => {
    await krizakaFetch("/api/me/profile", { method: "PATCH", json: { locale: values.locale, theme: values.theme } });
    setMode(values.theme);
    if (values.locale !== preferences.locale) router.replace(accountRoutes(values.locale).section("preferences"));
  });
  return (
    <SettingsSection variant="flat" title={say("account.profile.sections.preferences")} description={say("account.preferences.description")} save={form.save}>
      <SettingsRow label={say("account.profile.language")} description={say("account.preferences.languageHint")}>
        <LanguagePicker showLabel={false} label={say("account.profile.language")} value={form.draft.locale} languages={LANGUAGES} onValueChange={(locale) => form.set({ locale: locale as "en" | "fr" })} />
      </SettingsRow>
      <div className="py-4">
        <ChoiceCards
          label={say("account.preferences.theme")}
          value={form.draft.theme}
          onValueChange={(theme) => form.set({ theme: theme as Mode })}
          options={MODES.map((mode) => ({ id: mode, title: say(`account.preferences.themes.${mode}.title`), description: say(`account.preferences.themes.${mode}.hint`) }))}
        />
      </div>
    </SettingsSection>
  );
}
