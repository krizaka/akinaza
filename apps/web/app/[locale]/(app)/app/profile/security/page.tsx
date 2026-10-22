// @template: app-settings
import { SettingsSection } from "@krizaka/ui/settings-layout";

import { ChangePasswordForm } from "@/components/account/AccountForms";
import { ProfileFrame } from "@/components/account/ProfileFrame";
import { pageSession } from "@/lib/access";
import { asLocale, getDictionary } from "@/lib/i18n";

/** The password. Saving it ends every other session of the account. */
export default async function Security({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale).console.account.profile;
  const { account } = (await pageSession())!;
  return (
    <ProfileFrame locale={locale} current="security" account={account}>
      <SettingsSection variant="flat" title={t.passwordTitle}>
        <ChangePasswordForm />
      </SettingsSection>
    </ProfileFrame>
  );
}
