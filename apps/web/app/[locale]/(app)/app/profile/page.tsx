// @template: app-settings
import { shopOfOwner } from "@akinaza/db";
import { SettingsRow, SettingsSection } from "@krizaka/ui/settings-layout";

import { ProfileFrame } from "@/components/account/ProfileFrame";
import { pageSession } from "@/lib/access";
import { db } from "@/lib/db";
import { asLocale, getDictionary } from "@/lib/i18n";

const LANGUAGE_NAME = { en: "English", fr: "Français" } as const;

/** The account: the e-mail, the language, the role. The shop's owner is « Owner », whoever else signs in is a member. */
export default async function Profile({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale).console.account.profile;
  const { account } = (await pageSession())!;
  const owner = await shopOfOwner(db(), account.id);
  const role = account.role === "ADMIN" ? t.roleAdmin : owner ? t.roleOwner : t.roleUser;
  return (
    <ProfileFrame locale={locale} current="profile" account={account}>
      <SettingsSection variant="flat" title={t.sections.profile} description={t.description}>
        <SettingsRow label={t.email}>{account.email}</SettingsRow>
        <SettingsRow label={t.language}>{LANGUAGE_NAME[account.locale]}</SettingsRow>
        <SettingsRow label={t.role}>{role}</SettingsRow>
      </SettingsSection>
    </ProfileFrame>
  );
}
