// @template: app-settings
import { PreferencesSettings } from "@/components/account/PreferencesSettings";
import { ProfileFrame } from "@/components/account/ProfileFrame";
import { accountPage } from "@/lib/account-page";
import { asLocale } from "@/lib/i18n";
import { titleOf } from "@/lib/page-title";

export const dynamic = "force-dynamic";
export const generateMetadata = titleOf("profile");

/** Language and theme. */
export default async function Preferences({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const { profile } = await accountPage();
  return (
    <ProfileFrame locale={locale} current="preferences" account={profile}>
      <PreferencesSettings preferences={{ locale: profile.locale, theme: profile.theme }} />
    </ProfileFrame>
  );
}
