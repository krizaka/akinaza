// @template: app-settings
import { PreferencesSettings } from "@/components/account/PreferencesSettings";
import { ProfileFrame } from "@/components/account/ProfileFrame";
import { accountPage } from "@/lib/account-page";
import { asLocale } from "@/lib/i18n";
import { titleOf } from "@/lib/page-title";

export const dynamic = "force-dynamic";
export const generateMetadata = titleOf("profile");

/** Appearance: the theme, the density and the language. */
export default async function Preferences({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const locale = asLocale((await params).locale);
  const { profile, sections } = await accountPage();
  return (
    <ProfileFrame locale={locale} current="preferences" account={profile} sections={sections}>
      <PreferencesSettings preferences={{ locale: profile.locale }} />
    </ProfileFrame>
  );
}
