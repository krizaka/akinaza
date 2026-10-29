// @template: app-settings
import { SettingsSection } from "@krizaka/ui/settings-layout";

import { accounts } from "@/app/accounts";
import { systemClock } from "@/app/system-clock";
import { ChangePasswordForm } from "@/components/account/AccountForms";
import { ProfileFrame } from "@/components/account/ProfileFrame";
import { SessionsPanel } from "@/components/account/SessionsPanel";
import { accountPage } from "@/lib/account-page";
import { asLocale, getDictionary } from "@/lib/i18n";
import { titleOf } from "@/lib/page-title";

export const dynamic = "force-dynamic";
export const generateMetadata = titleOf("profile");

/** The password (saving it ends the other sign-ins) and the live sign-ins of the account. */
export default async function Security({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale).console.account.profile;
  const { session, profile, sections } = await accountPage();
  const sessions = await accounts().sessions(session.account.id, systemClock.now(), session.id);
  return (
    <ProfileFrame locale={locale} current="security" account={profile} sections={sections}>
      <SettingsSection variant="flat" title={t.passwordTitle}>
        <ChangePasswordForm />
      </SettingsSection>
      <SessionsPanel sessions={sessions.map((s) => ({ id: s.id, createdAt: new Date(s.createdAt).toISOString(), ip: s.ip, userAgent: s.userAgent, current: s.current }))} />
    </ProfileFrame>
  );
}
